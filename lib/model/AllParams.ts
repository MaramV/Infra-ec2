import * as ssm from 'aws-cdk-lib/aws-ssm';

interface GlobalTags {
  mapMigrated: string;
  budgetCode: string;
  costCenter: string;
}

interface Subnets {
  apacheAlb: string[];
  apacheEc2: string[];
  tomcat: string[];
}

interface Ami {
  tomcat: string;
  apache: string;
}

interface Route53 {
  zoneName: string;
  hostedZoneId: string;
  prefix: string;
}

interface ASG {
  min: number,
  max: number,
  desired: number
}

interface Account {
  vpcId: string;
  albLogPrefix: string;
  subnets: Subnets;
  certificate: string;
  certificateInternal: string;
  serverKey: string;
  ami: Ami;
  route53: Route53;
  asg: ASG;
  environment: string;
  pipelineBucket: string;
  dSystemEnvVariable: string;
  dCellVariable: string;
  dInfraVariable: string;
  dEnvironmentVariable: string;
  dPropertyServiceUrl: string;
  accountId: string;
}

interface AllParams {
  globalTags: GlobalTags;
  "otc-qa-vpc1": Account;
  "otc-preprod": Account;
  "otc-prodA": Account;
  "otc-prodB": Account;
}

class ParamValues implements AllParams {
  get globalTags() : GlobalTags { return this.params.globalTags; }
  get "otc-qa-vpc1"() : Account { return this.params["otc-qa-vpc1"]; }
  get "otc-preprod"() : Account { return this.params["otc-preprod"]; }
  get "otc-prodA"() : Account { return this.params["otc-prodA"]; }
  get "otc-prodB"() : Account { return this.params["otc-prodB"]; }

  constructor(private params: AllParams) {

  }

  account(contextValue: string) : Account {
    switch(contextValue) {
      case "otc-qa-vpc1":
        return this.params["otc-qa-vpc1"];
      case "otc-preprod":
        return this.params["otc-preprod"];
      case "otc-prodA":
        return this.params["otc-prodA"];
      case "otc-prodB":
        return this.params["otc-prodB"];
      default:
        throw "Account Environment not default";
    }
  }

}

export { AllParams, ParamValues, Account };
