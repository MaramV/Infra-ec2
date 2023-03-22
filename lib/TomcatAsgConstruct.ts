import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Account } from './model/AllParams';
import { TomcatService } from '../lib/model/TomcatServices';
import { readFileSync } from 'fs';
import { Service } from 'aws-cdk-lib/aws-servicediscovery';

export interface TomcatAsgProps {
  vpc: ec2.IVpc;
  ec2SecGrp: ec2.ISecurityGroup;
  ec2Role: iam.IRole;
  account: Account;
  alb: cdk.aws_elasticloadbalancingv2.ApplicationLoadBalancer;
  listener: elbv2.ApplicationListener,
  service: TomcatService;
  projectName: string;
}

// https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.Construct.html
export class TomcatAsgConstruct extends Construct {
  public readonly autoscalingGroup: autoscaling.AutoScalingGroup;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  constructor(scope: Construct, id: string, props: TomcatAsgProps) {
    super(scope, id);

    const that = this;

    let userData = readFileSync(`userdata/${props.service.userData}.txt`).toString();
    userData = userData.replace("{{dApplication}}", props.service.dApplication.toString());
    userData = userData.replace(/{{EnvironmentVariable}}/gm,props.account.environment.toLowerCase());
    userData = userData.replace(/{{AccountId}}/gm, cdk.Stack.of(this).account);
    userData = userData.replace("{{dSystemEnvVariable}}", props.account.dSystemEnvVariable.toString());
    userData = userData.replace("{{dCellVariable}}", props.account.dCellVariable.toString());
    userData = userData.replace("{{dInfraVariable}}", props.account.dInfraVariable.toString());
    userData = userData.replace("{{dEnvironmentVariable}}", props.account.dEnvironmentVariable.toString());
    userData = userData.replace("{{dPropertyServiceUrl}}", props.account.dPropertyServiceUrl.toString());
    userData = userData.replace(/{{servicename}}/gm, props.service.name.toLowerCase());
    userData = userData.replace("{{minMemory}}", props.service.minMemory);
    userData = userData.replace("{{maxMemory}}", props.service.maxMemory);

    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.LaunchTemplate.html
    const launchTemp = new ec2.LaunchTemplate(this,  `Tomcat-LT-${props.service.name}`, {
      machineImage: new ec2.LookupMachineImage({
        name: props.account.ami.tomcat.toString(),
        owners: [cdk.Stack.of(this).account]
      }),
      instanceType: new ec2.InstanceType(props.service.instanceType),
      securityGroup: props.ec2SecGrp,
      keyName: props.account.serverKey.toString(),
      role: props.ec2Role,
      userData: ec2.UserData.forLinux({
        shebang:userData
      }),
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(props.service.ebsSize, {
          deleteOnTermination: true,
          encrypted: true,
          volumeType: ec2.EbsDeviceVolumeType.GP2,
        })
      }],
    });
    cdk.Tags.of(launchTemp).add("amiType", "tomcat");

    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_autoscaling.AutoScalingGroup.html
    const asg = new autoscaling.AutoScalingGroup(this, `Tomcat-ASG-${props.service.name}`, {
      autoScalingGroupName: props.projectName !== "" ? `${props.projectName}-${props.service.name}` : props.service.name.toString(),
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.account.subnets.tomcat.map(function(subnetId: string, index) {
          return ec2.Subnet.fromSubnetId(that, `rTomcatEc2Sub${index}`, subnetId);
        }),
      },
      desiredCapacity: TomcatService.ScalingGroup(props.service, props.account.environment).desired,
      minCapacity: TomcatService.ScalingGroup(props.service, props.account.environment).min,
      maxCapacity: TomcatService.ScalingGroup(props.service, props.account.environment).max,
      launchTemplate: launchTemp,
      //requireImdsv2: true,
      // updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
      //   maxBatchSize: 1,
      //   minInstancesInService: props.account.asg.min,
      //   pauseTime: cdk.Duration.minutes(10),
      //   waitOnResourceSignals: true
      // }),
    });
    cdk.Tags.of(asg).add("Name", props.projectName !== "" ? `${props.projectName}-tomcat-${props.service.name}` : `tomcat-${props.service.name}`);
    cdk.Tags.of(asg).add("amiType", "tomcat");
    if (["Checkout", "F36Web", "MwWeb", "OtcWeb"].includes(props.service.name.toString())) {
      cdk.Tags.of(asg).add("Hazelcast", props.projectName);
      cdk.Tags.of(asg).add("HasHazelcast", "Yes");
      cdk.Tags.of(asg).add("Product", props.projectName);
    }

    const listenerName: string = props.projectName !== "" ? `ecom-${props.projectName}-${props.service.name}` : `ecom-${props.service.name}`;

    const targetgroup = props.listener.addTargets(`${props.service.name}-Target`, {
      targetGroupName: (listenerName.length < 33) ? listenerName : listenerName.substring(0,32),
      port: props.service.targetGroupPort,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      targets: [asg],
      priority: props.service.priority,
      conditions:[
        props.service.type === "PATH" ? elbv2.ListenerCondition.pathPatterns([
          `/${props.service.contextPath}/*`
        ]) : elbv2.ListenerCondition.hostHeaders([
          `${props.account.environment.toLowerCase()}-${props.projectName !== "" ? props.projectName + "-" : ""}${props.service.dApplication.toString().toLowerCase()}.${props.account.route53.zoneName}`.replace('proda-proda', 'proda').replace('prodb-prodb', 'prodb')
        ])
      ],
      healthCheck: {
        path: props.service.name === 'Checkout' ? '/checkout' : '/',
        healthyHttpCodes : props.service.name === 'Checkout' ? '302' : '200', 
        unhealthyThresholdCount: 2,
        healthyThresholdCount: 5,
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(30),
      }
    });

    asg.scaleOnRequestCount(`${props.projectName !== "" ? props.projectName + "-" : ""}${props.service.name}-Request`, {
      targetRequestsPerMinute: 70,
    });

    asg.scaleOnCpuUtilization(`${props.projectName !== "" ? props.projectName + "-" : ""}${props.service.name}-CPU`, {
      targetUtilizationPercent: 70,
    });

    this.targetGroup = targetgroup;
    this.autoscalingGroup = asg;
  }
}
