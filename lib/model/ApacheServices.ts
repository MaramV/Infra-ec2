interface ApacheService {
  name: String;
  contextPath: String;
  priority: number;
  siteId: string;
  siteVariable: string;
  targetGroup: any;
  autoScalingGroup: any;
  userData: String;
  ebsSize: number;
  targetGroupPort: number;
  host: String;
  deploymentFile: String;
}

interface ApacheServices {
  name: string;
  httpPort: number;
  httpsPort: number;
  allowCidr: AllowCidr;
  services: ApacheService[];
}

interface AllowCidr {
  ipv4: cidr[];
  ipv6: cidr[];
}

interface cidr {
  cidr: string;
  note: string;
}

export { ApacheServices, ApacheService };
