interface ScalingGroup {
  min: number;
  max: number;
  desired: number;
}

class TomcatService {
  name: String;
  contextPath: String;
  type: String;
  priority: number;
  targetGroup: any;
  autoScalingGroup: any;
  userData: String;
  ebsSize: number;
  targetGroupPort: number;
  dApplication: String;
  instanceType: string;
  minMemory: string;
  maxMemory: string;
  asgSizes: {
    qa: ScalingGroup,
    preProd: ScalingGroup,
    prod: ScalingGroup
  };

  static ScalingGroup(service: TomcatService, environment: String): ScalingGroup {
    switch(environment) {
      case "prodA":
        return service.asgSizes.prod;
      case "prodB":
        return service.asgSizes.prod;
      case "preProd":
        return service.asgSizes.preProd;
      default:
        return service.asgSizes.qa;
    }
  }
}

class TomcatServices {
  name: string;
  httpPort: number;
  httpsPort: number;
  services: TomcatService[];
  defaultInstanceType: string;
  defaultMinMemory: string;
  defaultMaxMemory: string;
  defaultAsgSizes: {
    qa: ScalingGroup,
    preProd: ScalingGroup,
    prod: ScalingGroup
  };

  static SetDefaults(services: TomcatServices): TomcatServices {
    for (let service of services.services) {
      if (!service.instanceType) {
        service.instanceType = services.defaultInstanceType;
      }

      if (!service.minMemory) {
        service.minMemory = services.defaultMinMemory;
      }

      if (!service.maxMemory) {
        service.maxMemory = services.defaultMaxMemory;
      }

      if (!service.asgSizes) {
        service.asgSizes = services.defaultAsgSizes;
      }
    }
    return services;
  }
}

export { TomcatServices, TomcatService };
