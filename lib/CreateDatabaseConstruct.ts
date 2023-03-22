import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { ApacheServices, ApacheService } from './model/ApacheServices';
import { Account } from './model/AllParams';
import { ApacheAsgConstruct } from './ApacheAsgConstruct';
import { ApachePipelineConstruct } from './ApachePipelineConstruct';
import { AccountPrincipal } from 'aws-cdk-lib/aws-iam';
import * as CustomResource from 'aws-cdk-lib/custom-resources';
import * as ecs from 'aws-cdk-lib/aws-ecs';

export interface CreateDatabaseConstructProps {
  vpc: ec2.IVpc;
  albSecGrp: ec2.ISecurityGroup;
  ec2SecGrp: ec2.ISecurityGroup;
  account: Account;
  apacheServices: ApacheServices;
  projectName: string;
}

// https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.Construct.html
export class CreateDatabaseConstruct extends Construct {
    readonly runOnceResource?: CustomResource.AwsCustomResource;

  constructor(scope: Construct, id: string, props: CreateDatabaseConstructProps) {
    super(scope, id);

    let task = ecs.FargateTaskDefinition.fromFargateTaskDefinitionArn(scope, 'fargateTaskLookup', 'arn:aws:ecs:us-west-2:246338920281:task-definition/OtcInfraGsrStackTaskDef127A16DD:2')

    const CreateDatabaseEvent = {
        service: 'ECS',
        action: 'runTask',
        parameters: {
          cluster: 'OtcInfraGsrStack-ClusterEB0386A7-mVUPZmhJ0Vs3',
          taskDefinition: 'arn:aws:ecs:us-west-2:246338920281:task-definition/OtcInfraGsrStackTaskDef127A16DD:2',
          capacityProviderStrategy: [
            {
              capacityProvider: 'FARGATE_SPOT',
              weight: 1,
            },
          ],
          launchType: 'FARGATE',
          platformVersion: 'LATEST',
          // networkConfiguration is not required with the `EXTERNAL` launch type
        //   networkConfiguration: props.launchType === LaunchType.EXTERNAL ? undefined : {
        //     awsvpcConfiguration: {
        //       assignPublicIp: 'DISABLED',
        //       subnets: vpc.selectSubnets(props.vpcSubnets ?? {
        //         subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        //       }).subnetIds,
        //       securityGroups: [this.securityGroup.securityGroupId],
        //     },
        //   },
        },
        physicalResourceId: CustomResource.PhysicalResourceId.of('arn:aws:ecs:us-west-2:246338920281:task-definition/OtcInfraGsrStackTaskDef127A16DD:2'),
      };

      const runTaskResource = new CustomResource.AwsCustomResource(this, 'EcsRunTask', {
        onCreate: CreateDatabaseEvent,
        // onUpdate: props.runOnResourceUpdate ? onEvent : undefined,
        policy: CustomResource.AwsCustomResourcePolicy.fromSdkCalls({ resources: ['arn:aws:ecs:us-west-2:246338920281:task-definition/OtcInfraGsrStackTaskDef127A16DD:2'] }),
        logRetention: logs.RetentionDays.ONE_WEEK,
        resourceType: 'Custom::RunTask',
      });

      this.runOnceResource = runTaskResource;
      if (task.taskRole) task.taskRole.grantPassRole(runTaskResource.grantPrincipal);
      if (task.executionRole) task.executionRole.grantPassRole(runTaskResource.grantPrincipal);
  }
}
