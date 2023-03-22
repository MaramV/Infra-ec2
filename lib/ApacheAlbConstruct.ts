import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ApacheServices, ApacheService } from './model/ApacheServices';
import { Account } from './model/AllParams';
import { ApacheAsgConstruct } from './ApacheAsgConstruct';
import { ApachePipelineConstruct } from './ApachePipelineConstruct';
import { AccountPrincipal } from 'aws-cdk-lib/aws-iam';

export interface ApacheAlbProps {
  vpc: ec2.IVpc;
  albSecGrp: ec2.ISecurityGroup;
  ec2SecGrp: ec2.ISecurityGroup;
  account: Account;
  apacheServices: ApacheServices;
  projectName: string;
}

// https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.Construct.html
export class ApacheAlbConstruct extends Construct {

  constructor(scope: Construct, id: string, props: ApacheAlbProps) {
    super(scope, id);

    const that = this;

    // Create a Apache ALB
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ApplicationLoadBalancer.html
    const alb = new elbv2.ApplicationLoadBalancer(this, "rApacheAlb", {
      loadBalancerName: `${props.projectName !== "" ? props.projectName : props.account.environment}-ApacheALB`,
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.account.subnets.apacheAlb.map(function(subnetId: string, index) {
          return ec2.Subnet.fromSubnetId(that, `rApacheAlbSub${index}`, subnetId);
        }),
      },
      securityGroup: props.albSecGrp,
      internetFacing: true,
    });
    alb.setAttribute("access_logs.s3.enabled", "true");
    alb.setAttribute("access_logs.s3.bucket", "otc-security-alb-logs");
    alb.setAttribute("access_logs.s3.prefix", props.account.albLogPrefix);


    const httpsListener = alb.addListener("rApacheAlbHttpsListener", {
      port: props.apacheServices.httpsPort,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [ {
        certificateArn: props.account.certificate
      }],
    });

    httpsListener.addAction("DefaultAction", {
      action: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain"
      }),
    });

    const iamPolicyApacheEc2 = new iam.PolicyDocument({
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
      ],
    });

    const iamRoleApacheEc2 = new iam.Role(this, `rApacheInstanceRole${props.projectName}`, {
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
        iamPolicyApacheEc2,
      }
    });

    props.apacheServices.services.forEach(function (service: ApacheService) {
      const asg = new ApacheAsgConstruct(that, `rApache${service.name}`, {
        vpc: props.vpc,
        ec2SecGrp: props.ec2SecGrp,
        ec2Role: iamRoleApacheEc2,
        account: props.account,
        alb: alb,
        listener: httpsListener,
        service: service,
        projectName: props.projectName,
      });
      service.autoScalingGroup = asg.autoscalingGroup;
      service.targetGroup = asg.targetGroup;
    });
    //console.log("props.service.services: ", props.apacheServices.services)

    new ApachePipelineConstruct(this, `${props.projectName}Pipeline`,{
      apacheServices: props.apacheServices,
      projectName: props.projectName,
      account: props.account,
    });
  }
}
