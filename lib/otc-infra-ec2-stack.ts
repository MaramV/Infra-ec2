import { Construct } from 'constructs';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as trigger from 'aws-cdk-lib/triggers';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as route53 from 'aws-cdk-lib/aws-route53';
import { AllParams, ParamValues } from './model/AllParams';
import { TomcatServices, TomcatService } from './model/TomcatServices';
import { ApacheServices } from './model/ApacheServices';
import { TomcatAlbConstruct } from './TomcatAlbConstruct';
import { ApacheAlbConstruct } from './ApacheAlbConstruct';
// import { CreateDatabaseConstruct } from './CreateDatabaseConstruct';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { PropagatedTagSource } from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEvents from 'aws-cdk-lib/aws-events-targets';
import * as events from 'aws-cdk-lib/aws-events';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
var path = require('path')

export class OtcInfraEc2Stack extends Stack {
  constructor(scope: Construct, id: string, projectName: string, params: AllParams, apacheServices: ApacheServices, tomcatServices: TomcatServices, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const paramValues = new ParamValues(params);
    const account = paramValues.account(this.node.tryGetContext("accountEnv"));
    //projectName =  account.environment === "qa" ? projectName : "";
    projectName =  account.environment.toLowerCase() === "preprod" ? "" : projectName;
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Vpc.html
    const vpc = ec2.Vpc.fromLookup(this, "rVpc", { vpcId: account.vpcId });

    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53.HostedZone.html
    const r53Zone = route53.HostedZone.fromHostedZoneAttributes(this, "rRoute53Zone", {
      zoneName: account.route53.zoneName,
      hostedZoneId: account.route53.hostedZoneId
    });

    // Create a Lambda to transfer the and prep files that the rest of the stack will use
    // Policy for Lambda IAM Role
    const lambdaRolePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: [
            'lambda:*',
            's3:*',
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ]
        })
      ]
    });

    // IAM role for Lmabda
    const lambdaRole = new iam.Role(this, 'rLambdaFileTransferRole', {
      roleName: `rLambdaFileTransferRole${projectName}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM Role for Lambda to Prep S3 files for predeployment',
      inlinePolicies: {
        lambdaRolePolicy
      }
    });

    const serviceNames = tomcatServices.services.map(x => x.contextPath);

    // Create the Lambda
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html
    const transferLambda = new nodeLambda.NodejsFunction(this, 'rLambdaFileTransfer', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'lambdaHandler',
      entry: path.join(__dirname, 'lambda/transferLambda.ts'),
      description: 'Lambda to prop up files for tomcat deployment',
      role: lambdaRole,
      environment: {
        region: this.region,
        account: this.account,
        project: projectName,
        service: JSON.stringify(serviceNames),
      },
      bundling: {
        externalModules: ['aws-sdk', 'aws-lambda']
      },
      timeout: cdk.Duration.seconds(30),
    });

    const lambdaTrigger = new trigger.Trigger(this, 'rFileTransferTrigger', {
      handler: transferLambda
    });

    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SecurityGroup.html
    // Create Security Groups, and Ingress Rules for:
    // Get GSR ALB Security Group
    const gsrAlbSecGrp = ec2.SecurityGroup.fromLookupByName(this,
      'rGsrAlbSecGrp',
      'GSR-ALB-SG',
      vpc
    );

    // Apache ALB
    const apacheAlbSecGrp = new ec2.SecurityGroup(this, "rApacheAlbSecGrp", {
      vpc: vpc,
      securityGroupName: `Apache-ALB-SG-${projectName}`,
    });

    // Update Apache ALB SecGrp to limit access to ONLY Akamai CIDRS
    // Configuration file set from: https://techdocs.akamai.com/property-mgr/docs/origin-ip-access-control
    for (const ip of apacheServices.allowCidr.ipv4) {
      apacheAlbSecGrp.addIngressRule(
        ec2.Peer.ipv4(ip.cidr),
        ec2.Port.tcp(443),
        ip.note
      );
    }

    for (const ip of apacheServices.allowCidr.ipv6) {
      apacheAlbSecGrp.addIngressRule(
        ec2.Peer.ipv6(ip.cidr),
        ec2.Port.tcp(443),
        ip.note
      );
    }

    // Apache EC2s
    const apacheEc2SecGrp = new ec2.SecurityGroup(this, "rApacheEc2SecGrp", {
      vpc: vpc,
      securityGroupName: `Apache-EC2-SG-${projectName}`,
    });
    apacheEc2SecGrp.addIngressRule(
      apacheAlbSecGrp,
      ec2.Port.tcp(443),
      "Port 443/HTTPS from ALBs"
    );
    gsrAlbSecGrp.addIngressRule(
      apacheEc2SecGrp,
      ec2.Port.tcp(443),
      "Port 443/HTTP from Apache EC2"
    );

    const CodeDeploySecurityGroup = ec2.SecurityGroup.fromLookupByName(this,"CodeDeploySecurityGroup","ecom-SecretsManagerSecurityGroup",vpc);
    const SecretsManagerSecurityGroup = ec2.SecurityGroup.fromLookupByName(this,"SecretsManagerSecurityGroup","ecom-CodeDeploySecurityGroup",vpc);

    apacheEc2SecGrp.addIngressRule(
      CodeDeploySecurityGroup,
      ec2.Port.allTraffic(),
      "Traffic from CodeDeploy"
    );

    apacheEc2SecGrp.addIngressRule(
      SecretsManagerSecurityGroup,
      ec2.Port.allTraffic(),
      "Traffic from Secrets Manager"
    );

    CodeDeploySecurityGroup.addIngressRule(
      apacheEc2SecGrp,
      ec2.Port.allTraffic(),
      "Apache EC2 Security Group"
    );

    SecretsManagerSecurityGroup.addIngressRule(
      apacheEc2SecGrp,
      ec2.Port.allTraffic(),
      "Apache EC2 Security Group"
    );


    // Tomcat ALB
    const tomcatAlbSecGrp = new ec2.SecurityGroup(this, "rTomcatAlbSecGrp", {
      vpc: vpc,
      securityGroupName: `Tomcat-ALB-SG-${projectName}`,
    });
    tomcatAlbSecGrp.addIngressRule(
      apacheEc2SecGrp,
      ec2.Port.tcp(443),
      "Port 443/HTTPS from Apache EC2"
    );

    // Tomcat EC2s
    const tomcatEc2SecGrp = new ec2.SecurityGroup(this, "rTomcatEc2SecGrp", {
      vpc: vpc,
      securityGroupName: `Tomcat-EC2-SG-${projectName}`,
    });
    tomcatEc2SecGrp.addIngressRule(
      tomcatAlbSecGrp,
      ec2.Port.tcp(8443),
      "Port 8443/HTPS from ALBs"
    );

    tomcatEc2SecGrp.addIngressRule(
      CodeDeploySecurityGroup,
      ec2.Port.allTraffic(),
      "Traffic from CodeDeploy"
    );

    tomcatEc2SecGrp.addIngressRule(
      SecretsManagerSecurityGroup,
      ec2.Port.allTraffic(),
      "Traffic from Secrets Manager"
    );

    tomcatEc2SecGrp.addIngressRule(
      tomcatEc2SecGrp,
      ec2.Port.tcpRange(8995,9095), //ec2.Port.tcpRange(8995,9095),
      "Hazelcast"
    );

    // Begin Tomcat Clustering Ingress Rules
    tomcatEc2SecGrp.addIngressRule(
      ec2.Peer.ipv4("10.241.0.0/16"),
      ec2.Port.allUdp(),
      "UDP for Multicast"
    );

    new ec2.CfnSecurityGroupIngress(this, "rTCSecGrpIgmpIngress", {
      ipProtocol: "2",  // 2 = IGMP: https://www.iana.org/assignments/protocol-numbers/protocol-numbers.xhtml
      cidrIp: "0.0.0.0/0",
      groupId: tomcatEc2SecGrp.securityGroupId,
      description: "IGMP for Multicast"
    });

    tomcatEc2SecGrp.addIngressRule(
      tomcatEc2SecGrp,
      ec2.Port.tcpRange(4000, 4100),
      "Tomcat Clustering TCP"
    )
    // End Tomcat Clustering Ingress Rules

    CodeDeploySecurityGroup.addIngressRule(
      tomcatEc2SecGrp,
      ec2.Port.allTraffic(),
      "Tomcat EC2 Security Group"
    );

    SecretsManagerSecurityGroup.addIngressRule(
      tomcatEc2SecGrp,
      ec2.Port.allTraffic(),
      "Tomcat EC2 Security Group"
    );

    const apacheAlb = new ApacheAlbConstruct(this, "rApacheAlb", {
      vpc,
      albSecGrp: apacheAlbSecGrp,
      ec2SecGrp: apacheEc2SecGrp,
      account,
      apacheServices: apacheServices,
      projectName,
    });

    const tomcatAlb = new TomcatAlbConstruct(this, "rTomcatAlb", {
      vpc,
      r53: r53Zone,
      albSecGrp: tomcatAlbSecGrp,
      ec2SecGrp: tomcatEc2SecGrp,
      account,
      tomcatServices: tomcatServices,
      projectName,
    });

    // Create a Lambda to transfer the and prep files that the rest of the stack will use
    // Policy for Lambda IAM Role
    const HazellambdaRolePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: [
            'lambda:*',
            'ec2:*',
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ]
        })
      ]
    });

    // IAM role for Lmabda
    const hazelLambdaRole = new iam.Role(this, 'rHazelLambdaRole', {
      roleName: `rHazelLambdaRole${projectName}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM Role for Lambda to Prep S3 files for predeployment',
      inlinePolicies: {
        HazellambdaRolePolicy
      }
    });

    // Create the Lambda
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html
    const hazelTransferLambdass = new nodeLambda.NodejsFunction(this, 'rHazelLambda', {
      functionName: projectName !== "" ? `${projectName}-HazelcastChecker` : "HazelcastChecker",
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambda/hazelcastcheck.js'),
      description: 'Lambda to prop up files for tomcat deployment',
      role: hazelLambdaRole,
      environment: {
        region: this.region,
        account: this.account,
        project: projectName
      },
      bundling: {
        externalModules: ['aws-sdk', 'aws-lambda']
      },
      securityGroups: [tomcatEc2SecGrp],
      vpc: vpc,
      vpcSubnets: {subnetFilters:[ec2.SubnetFilter.byIds(account.subnets.tomcat)]},
      timeout: cdk.Duration.seconds(30),
    });

    // Register the Lambda as an event rule target
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events_targets.LambdaFunction.html
    const hazelRuleTarget = new lambdaEvents.LambdaFunction(hazelTransferLambdass, {
      maxEventAge: cdk.Duration.hours(1),
      retryAttempts: 2
    });

    // Create EventBridge Rule
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events.Rule.html
    const hazelRule = new events.Rule(this, 'rHazelEventRule', {
      ruleName: projectName !== "" ? `${projectName}-HazelcastChecker` : "HazelcastChecker",
      description: "Scheduling run for the Lambda",
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      enabled: true
    });
    hazelRule.addTarget(hazelRuleTarget);
    cdk.Tags.of(hazelRule).add("map-migrated", params.globalTags.mapMigrated);

    // Create a CloudWatch Metric for Lambda errors
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.Metric.html
    const hazelErrorRate = hazelTransferLambdass.metricErrors({
      statistic: 'sum',
      period: Duration.minutes(15),
      label: 'Lambda failure rate for Hazel check'
    });

    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.Alarm.html
    const hazelAlarm = new cloudwatch.Alarm(this, 'rHazelCWAlarm', {
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      threshold: 2,
      evaluationPeriods: 2,
      metric: hazelErrorRate,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING
    });
    cdk.Tags.of(hazelAlarm).add("map-migrated", params.globalTags.mapMigrated);

    if (account.environment === "qa")
    {
      // ToDo: Parameterize the SNS Topic Arn
      // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sns.Topic.html
      const alarmTopic = sns.Topic.fromTopicArn(this, "rHazelAlarmTopic", "arn:aws:sns:us-west-2:246338920281:CloudWatchAutoAlarmsSNSTopic");

      // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch_actions.SnsAction.html
      const hazelAlarmAction = new cloudwatchActions.SnsAction(alarmTopic);

      hazelAlarm.addAlarmAction(hazelAlarmAction);
    }

    // new CreateDatabaseConstruct(this, "rCreateDatabaseConstruct", {
    //   vpc,
    //   albSecGrp: apacheAlbSecGrp,
    //   ec2SecGrp: apacheEc2SecGrp,
    //   account,
    //   apacheServices: apacheServices,
    //   projectName: account.environment === "qa" ? projectName : "",
    // });

    cdk.Tags.of(scope).add("Environment", account.environment);
  }
}
