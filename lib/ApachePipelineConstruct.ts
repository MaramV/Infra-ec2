import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as codepipeline from 	'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions'
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam';
import { Account } from './model/AllParams';
import { ApacheService } from './model/ApacheServices';
import * as codestar from 'aws-cdk-lib/aws-codestarnotifications';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface ApacheAsgProps {
  apacheServices: any;
  projectName: string;
  account: Account;
}

// https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.Construct.html
export class ApachePipelineConstruct extends Construct {

  constructor(scope: Construct, id: string, props: ApacheAsgProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    //ToDo: Pull this from config per account (qa/preprod/prod)
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.Bucket.html
    const pipelineArtifactBucket = s3.Bucket.fromBucketName(this, "rDeployArtifactBucket", `${accountId}-pipeline-artifacts`);

    const that = this;
    const codedeployPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          actions: [
              "autoscaling:*",
              "codedeploy:*",
              "ec2:*",
              "lambda:*",
              "ecs:*",
              "sns:*",
              "elasticloadbalancing:*",
              "iam:AddRoleToInstanceProfile",
              "iam:AttachRolePolicy",
              "iam:CreateInstanceProfile",
              "iam:CreateRole",
              "iam:DeleteInstanceProfile",
              "iam:DeleteRole",
              "iam:DeleteRolePolicy",
              "iam:GetInstanceProfile",
              "iam:GetRole",
              "iam:GetRolePolicy",
              "iam:ListInstanceProfilesForRole",
              "iam:ListRolePolicies",
              "iam:ListRoles",
              "iam:PutRolePolicy",
              "iam:RemoveRoleFromInstanceProfile",
              "s3:*",
              "ssm:*"
          ],
        }),
      ],
    });

    const codeDeployRole = new iam.Role(this, `rCodeDeployRole${props.projectName}`, {
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      description: `Codedeploy Profile Role for ${props.projectName}`,
      inlinePolicies: {
        codedeployPolicy
      },
    });

    const pipelinePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          actions: [
            "s3:PutObject",
            "s3:GetObject",
            "s3:GetObjectVersion",
            "codedeploy:GetApplication",
            "codedeploy:BatchGetApplications",
            "codedeploy:GetDeploymentGroup",
            "codedeploy:BatchGetDeploymentGroups",
            "codedeploy:ListApplications",
            "codedeploy:ListDeploymentGroups",
            "sns:*",
          ],
        }),
      ],
    });


    const DeploymentPipelinePolicy = new iam.Policy(this, `rDeploymentPipelinePolicy${props.projectName}`, {
      document: pipelinePolicy,
      policyName: `${props.projectName !== "" ? props.projectName + "-" : ""}peployment-pipeline-policy`
    });


    const CodePipelinePolicyDocument = new iam.PolicyDocument({
      statements: [new iam.PolicyStatement({
          actions: [
              "s3:*",
              "codedeploy:*",
          ],
          resources: ['*'],
      })],
    });

    const PipelineRole = new iam.Role(this, `rPipelineRole${props.projectName}`, {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      description: `Apache Codedeploy Profile Role for ${props.projectName}`,
      inlinePolicies: {
        CodePipelinePolicyDocument
      },
    });

    const application = new codedeploy.ServerApplication(this, 'CodeDeployApplication', {
      applicationName: props.projectName !== '' ? `${props.projectName}-${props.apacheServices.name}-application` : `${props.apacheServices.name}-application`, // optional property
    });

    const pipelinenotifications = ssm.StringParameter.fromStringParameterAttributes(this, `GetPipelineNotifications-${props.apacheServices.name}`, {
      parameterName: `/${props.account.environment}/pipelinenotifications/arn`,
    }).stringValue;

    props.apacheServices.services.forEach((service:ApacheService) => {
      const deploymentGroup = new codedeploy.ServerDeploymentGroup(this, `DeploymentGroup-${service.name}`, {
        loadBalancer: codedeploy.LoadBalancer.application(service.targetGroup),
        autoScalingGroups: [service.autoScalingGroup],//[service.asg],
        deploymentGroupName: `${props.projectName !== "" ? props.projectName + "-" : ""}${props.apacheServices.name}-${service.name}`,
        deploymentConfig: codedeploy.ServerDeploymentConfig.ONE_AT_A_TIME,
        role: codeDeployRole,
        installAgent: true,
        application: application
      });
      const pipeline = new codepipeline.Pipeline(this, `dg-pl-${service.name}`, {
        pipelineName:`${props.projectName !== "" ? props.projectName + "-" : ""}${props.apacheServices.name}-${service.name}`,
        restartExecutionOnUpdate:true,
        role: PipelineRole,
        artifactBucket: pipelineArtifactBucket,
      });

      const sourceOutput = new codepipeline.Artifact();

      const sourceStage = pipeline.addStage({ stageName: 'Source' });
      sourceStage.addAction(new codepipeline_actions.S3SourceAction({
        actionName: 'S3Source',
        bucketKey: `${props.projectName !== "" ? props.projectName + "/" : ""}${service.deploymentFile}.zip`,
        bucket: s3.Bucket.fromBucketName(this, `pl-gsa-${service.name}`, props.account.pipelineBucket),
        output: sourceOutput,
        trigger: codepipeline_actions.S3Trigger.EVENTS, // default: S3Trigger.POLL
      }));
      const deployStage = pipeline.addStage({ stageName: 'Deploy' });
      deployStage.addAction(new codepipeline_actions.CodeDeployServerDeployAction({
        actionName: 'CodeDeploy',
        input: sourceOutput,
        deploymentGroup
      }));



      const notifcationRule = new codestar.NotificationRule(this, `${service.name}-notifaction-rule`, {
        source: pipeline,
        events: [
          'codepipeline-pipeline-pipeline-execution-failed',
          'codepipeline-pipeline-pipeline-execution-canceled',
          'codepipeline-pipeline-pipeline-execution-succeeded'
        ],
        targets: [sns.Topic.fromTopicArn(this,`${service.name}-search-topic`, pipelinenotifications)],
      });
    });

  }
}
