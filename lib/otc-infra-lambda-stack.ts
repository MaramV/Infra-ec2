import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as trigger from 'aws-cdk-lib/triggers';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as route53 from 'aws-cdk-lib/aws-route53';
import { AllParams, ParamValues } from './model/AllParams';
import { TomcatServices, TomcatService } from './model/TomcatServices';
import { ApacheServices, ApacheService } from './model/ApacheServices';
import { TomcatAlbConstruct } from './TomcatAlbConstruct';
import { ApacheAlbConstruct } from './ApacheAlbConstruct';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { PropagatedTagSource } from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
var path = require('path');

export class OtcInfraLambdaStack extends Stack {
  constructor(scope: Construct, id: string, projectName: string, params: AllParams, apacheServices: ApacheServices, tomcatServices: TomcatServices, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const paramValues = new ParamValues(params);
    const account = paramValues.account(this.node.tryGetContext("accountEnv"));
    //projectName =  account.environment === "qa" ? projectName : "";
    projectName =  account.environment === "preprod" ? "" : projectName;
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Vpc.html

    // Create a Lambda to transfer the and prep files that the rest of the stack will use
    // Policy for Lambda IAM Role
    // const lambdaRolePolicy = new iam.PolicyDocument({
    //   statements: [
    //     new iam.PolicyStatement({
    //       resources: ['*'],
    //       actions: [
    //         'lambda:*',
    //         's3:*',
    //         'logs:CreateLogGroup',
    //         'logs:CreateLogStream',
    //         'logs:PutLogEvents',
    //       ]
    //     })
    //   ]
    // });

    // // IAM role for Lmabda
    // const lambdaRole = new iam.Role(this, 'rLambdaFileTransferRole', {
    //   roleName: `rLambdaFileTransferRole${projectName}`,
    //   assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    //   description: 'IAM Role for Lambda to Prep S3 files for predeployment',
    //   inlinePolicies: {
    //     lambdaRolePolicy
    //   }
    // });

    // const serviceNames = tomcatServices.services.map(x => x.contextPath);

    // // Create the Lambda
    // const transferLambda = new nodeLambda.NodejsFunction(this, 'rLambdaFileTransfer', {
    //   runtime: lambda.Runtime.NODEJS_14_X,
    //   handler: 'lambdaHandler',
    //   entry: path.join(__dirname, 'lambda/transferLambda.ts'),
    //   description: 'Lambda to prop up files for tomcat deployment',
    //   role: lambdaRole,
    //   environment: {
    //     region: this.region,
    //     account: this.account,
    //     project: projectName,
    //     service: JSON.stringify(serviceNames),
    //   },
    //   bundling: {
    //     externalModules: ['aws-sdk', 'aws-lambda']
    //   },
    //   timeout: cdk.Duration.seconds(30),
    // });

    // const lambdaTrigger = new trigger.Trigger(this, 'rFileTransferTrigger', {
    //   handler: transferLambda
    // });

    const scaleLambdaRolePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: [
            'lambda:*',
            'autoscaling:*',
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ]
        })
      ]
    });

    const scaleLambdaRole = new iam.Role(this, 'rscaleLambdaRole', {
      roleName: `rLambdaScaleLambdaRole${projectName}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM Role for Lambda to Prep S3 files for predeployment',
      inlinePolicies: {
        scaleLambdaRolePolicy
      }
    });

    const stackScope = this;

    new nodeLambda.NodejsFunction(stackScope, `r${projectName}rLambdaScaleDown`, {
      functionName: projectName !== "" ? `${projectName}-scaleDown` : "scaleDown",
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'lambdaHandler',
      entry: path.join(__dirname, 'lambda/scaleDownLambda.ts'),
      description: 'Lambda to scale autoscaling group to 0 instances',
      role: scaleLambdaRole,
      environment: {
        region: stackScope.region,
        account: stackScope.account,
      },
      bundling: {
        externalModules: ['aws-sdk', 'aws-lambda']
      },
      timeout: cdk.Duration.seconds(30),
    });

    new nodeLambda.NodejsFunction(stackScope, `r${projectName}rLambdaScaleUp`, {
      functionName: projectName !== "" ? `${projectName}-scaleUp` : "scaleUp",
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'lambdaHandler',
      entry: path.join(__dirname, 'lambda/scaleUpLambda.ts'),
      description: 'Lambda to scale autoscaling group to 0 instances',
      role: scaleLambdaRole,
      environment: {
        region: stackScope.region,
        account: stackScope.account,
      },
      bundling: {
        externalModules: ['aws-sdk', 'aws-lambda']
      },
      timeout: cdk.Duration.seconds(30),
    });

    cdk.Tags.of(scope).add("Environment", account.environment);
  }
}
