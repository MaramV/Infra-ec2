import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Account } from './model/AllParams';
import { ApacheService } from '../lib/model/ApacheServices';
import { readFileSync } from 'fs';

export interface ApacheAsgProps {
  vpc: ec2.IVpc;
  ec2SecGrp: ec2.ISecurityGroup;
  ec2Role: iam.IRole;
  account: Account;
  alb: cdk.aws_elasticloadbalancingv2.ApplicationLoadBalancer;
  listener: elbv2.ApplicationListener,
  service: ApacheService;
  projectName: string;
}

// https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.Construct.html
export class ApacheAsgConstruct extends Construct {
  public readonly autoscalingGroup: autoscaling.AutoScalingGroup;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  constructor(scope: Construct, id: string, props: ApacheAsgProps) {
    super(scope, id);

    const that = this;


    let userdata = readFileSync(`userdata/${props.service.userData}.txt`).toString();
    userdata = userdata.replace("$SitesVariable",props.service.siteVariable);
    userdata = userdata.replace("$SiteId",props.service.siteId);
    userdata = userdata.replace("$ProjectVariableNoEcom",props.projectName !== "" ? "-" + props.projectName.replace("ecomm","") : "");
    userdata = userdata.replace("$ProjectVariable",props.projectName !== "" ? "-" + props.projectName : "");
    userdata = userdata.replace("$EnvironmentVariable",props.account.environment.toLowerCase());
    userdata = userdata.replace(/{{EnvironmentVariable}}/gm,props.account.environment.toLowerCase());
    userdata = userdata.replace(/{{servicename}}/gm, props.service.name.toLowerCase());
    userdata = userdata.replace(/{{AccountId}}/gm, cdk.Stack.of(this).account);
    userdata = userdata.replace("$Route53Domain", props.account.route53.zoneName);

    const launchTemp = new ec2.LaunchTemplate(this,  `Apache-LT-${props.service.name}`, {
      machineImage: new ec2.LookupMachineImage({
        name: props.account.ami.apache.toString(),
        owners: [cdk.Stack.of(this).account]
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      securityGroup: props.ec2SecGrp,
      keyName: props.account.serverKey.toString(),
      role: props.ec2Role,
      userData: ec2.UserData.forLinux({shebang:userdata}),
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(props.service.ebsSize, {
          deleteOnTermination: true,
          encrypted: true,
          volumeType: ec2.EbsDeviceVolumeType.GP2,
        })
      }],
    });
    cdk.Tags.of(launchTemp).add("amiType", "apache");

    const asg = new autoscaling.AutoScalingGroup(this, `Apache-ASG-${props.service.name}`, {
      autoScalingGroupName: props.projectName !== "" ? `${props.projectName}-${props.service.name}` : props.service.name.toString(),
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.account.subnets.apacheEc2.map(function(subnetId: string, index) {
          return ec2.Subnet.fromSubnetId(that, `rApacheEc2Sub${index}`, subnetId);
        }),
      },
      desiredCapacity: props.account.asg.desired,
      minCapacity: props.account.asg.min,
      maxCapacity: props.account.asg.max,
      launchTemplate: launchTemp,
      //requireImdsv2: true,
      // updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
      //   maxBatchSize: 1,
      //   minInstancesInService: props.account.asg.min,
      //   pauseTime: cdk.Duration.minutes(10),
      //   waitOnResourceSignals: true
      // }),
    });
    cdk.Tags.of(asg).add("Name", `${props.projectName !== "" ? props.projectName + "-" : ""}apache-${props.service.name}`);
    cdk.Tags.of(asg).add("amiType", "apache");

    const listenerName: string = props.projectName !== "" ? `ecom-${props.projectName}-${props.service.name}` : `ecom-${props.service.name}`;

    const targetgroup = props.listener.addTargets(`${props.service.name}-Target`, {
      targetGroupName: (listenerName.length < 33) ? listenerName : listenerName.substring(0,32),
      port: props.service.targetGroupPort,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      targets: [asg],
      priority: props.service.priority,
      conditions: [
        elbv2.ListenerCondition.hostHeaders([
          //`${props.account.environment.toLowerCase()}${props.projectName !== '' ? "-" + props.projectName.replace("ecomm","") : ""}${props.service.siteId}.orientaltrading.com`.replace(/prod(A|B|a|b)\-/gi, ''),
          //`${props.account.environment.toLowerCase()}${props.projectName !== '' ? "-" + props.projectName.replace("ecomm","") : ""}${props.service.siteId}-services.orientaltrading.com`.replace(/prod(A|B|a|b)\-/gi, ''),
          `${props.account.environment.toLowerCase()}${props.projectName !== '' ? "-" + props.projectName.replace("ecomm","") : ""}${props.service.siteId}.orientaltrading.com`.replace('proda-proda', 'proda').replace('prodb-prodb', 'prodb'),
          `${props.account.environment.toLowerCase()}${props.projectName !== '' ? "-" + props.projectName.replace("ecomm","") : ""}${props.service.siteId}-services.orientaltrading.com`.replace('proda-proda', 'proda').replace('prodb-prodb', 'prodb'),
          props.service.host.toString()
        ])
      ],
      healthCheck: {
        path: '/',
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
