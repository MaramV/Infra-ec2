import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import { TomcatServices, TomcatService } from './model/TomcatServices';
import { Account } from './model/AllParams';
import { TomcatAsgConstruct } from './TomcatAsgConstruct';
import { PipelineConstruct } from './TomcatPipelineConstruct';

export interface TomcatAlbProps {
  vpc: ec2.IVpc;
  r53: route53.IHostedZone;
  albSecGrp: ec2.ISecurityGroup;
  ec2SecGrp: ec2.ISecurityGroup;
  account: Account;
  tomcatServices: TomcatServices;
  projectName: string;
}

// https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.Construct.html
export class TomcatAlbConstruct extends Construct {

  constructor(scope: Construct, id: string, props: TomcatAlbProps) {
    super(scope, id);

    const that = this;

    // Create a Tomcat ALB
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ApplicationLoadBalancer.html
    const alb = new elbv2.ApplicationLoadBalancer(this, "rTomcatAlb", {
      loadBalancerName: `${props.projectName !== "" ? props.projectName : props.account.environment}-TomcatALB`,
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.account.subnets.tomcat.map(function(subnetId: string, index) {
          return ec2.Subnet.fromSubnetId(that, `rTomcatAlbSub${index}`, subnetId);
        }),
      },
      securityGroup: props.albSecGrp,
      internetFacing: false,
    });
    alb.setAttribute("access_logs.s3.enabled", "true");
    alb.setAttribute("access_logs.s3.bucket", "otc-security-alb-logs");
    alb.setAttribute("access_logs.s3.prefix", props.account.albLogPrefix);

    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53_targets.LoadBalancerTarget.html
    new route53.ARecord(this, "rTomcatR53", {
      zone: props.r53,
      //recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}services.${props.account.route53.zoneName}`,
      recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}services.${props.account.route53.zoneName}`.replace('proda-proda', 'proda').replace('prodb-prodb', 'prodb'),
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb))
    });

    new route53.ARecord(this, "rTomcatR53OtcWeb", {
      zone: props.r53,
      //recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}otc.${props.account.route53.zoneName}`,
      recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}otc.${props.account.route53.zoneName}`.replace('proda-proda', 'proda').replace('prodb-prodb', 'prodb'),
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb))
    });

    new route53.ARecord(this, "rTomcatR53F36", {
      zone: props.r53,
      //recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}f36.${props.account.route53.zoneName}`,
      recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}f36.${props.account.route53.zoneName}`.replace('proda-proda', 'proda').replace('prodb-prodb', 'prodb'),
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb))
    });

    new route53.ARecord(this, "rTomcatR53MW", {
      zone: props.r53,
      //recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}mw.${props.account.route53.zoneName}`,
      recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}mw.${props.account.route53.zoneName}`.replace('proda-proda', 'proda').replace('prodb-prodb', 'prodb'),
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb))
    });

    new route53.ARecord(this, "rTomcatR53Checkout", {
      zone: props.r53,
      //recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}checkout.${props.account.route53.zoneName}`,
      recordName: `${props.account.route53.prefix}-${props.projectName !== "" ? props.projectName + "-" : ""}checkout.${props.account.route53.zoneName}`.replace('proda-proda', 'proda').replace('prodb-prodb', 'prodb'),
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb))
    });

    const httpsListener = alb.addListener("rTomcatAlbHttpsListener", {
      port: props.tomcatServices.httpsPort,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [ {
        certificateArn: props.account.certificateInternal
      }],
    });

    httpsListener.addAction("DefaultAction", {
      action: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain"
      }),
    });

    const iamPolicyTomcatEc2 = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          actions: [
            "iam:PassRole",
            "iam:GetRole",
            "cloudwatch:PutMetricAlarm",
            "cloudwatch:DescribeAlarms",
            "application-autoscaling:*"
          ],
        }),
        new iam.PolicyStatement({
          resources: [
            `arn:aws:s3:::${cdk.Stack.of(this).account}-order-number`
          ],
          actions: [
            's3:ListBucket'
          ],
        }),
        new iam.PolicyStatement({
          resources: [
            `arn:aws:s3:::${cdk.Stack.of(this).account}-order-number/*`
          ],
          actions: [
            's3:*Object'
          ],
        }),
      ],
    });

    const iamRoleTomcatEc2 = new iam.Role(this, `rTomcatInstanceRole${props.projectName}`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: `EC2 Instance Profile Role for ${props.projectName}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMDirectoryServiceAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("IAMUserSSHKeys"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite"),
      ],
      inlinePolicies: {
        iamPolicyTomcatEc2,
      }
    });

    props.tomcatServices.services.forEach(function (service: TomcatService) {
      //console.log(`Call TomcatAsgConstruct for ${service.contextPath}`);
      const asg = new TomcatAsgConstruct(that, `rTomcat${service.name}`, {
        vpc: props.vpc,
        ec2SecGrp: props.ec2SecGrp,
        ec2Role: iamRoleTomcatEc2,
        account: props.account,
        alb: alb,
        listener: httpsListener,
        service: service,
        projectName: props.projectName,
      });
      service.targetGroup = asg.targetGroup;
      service.autoScalingGroup = asg.autoscalingGroup;
    });

    new PipelineConstruct(this, 'testingPipeline',{
      tomcatServices: props.tomcatServices,
      projectName: props.projectName,
      account: props.account,
    });
  }
}
