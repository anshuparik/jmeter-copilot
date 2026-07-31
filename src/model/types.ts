export interface AssertionResult {
  name?: string;
  failure?: boolean;
  failureMessage?: string;
  success?: boolean;
}

export interface SampleResult {
  label?: string;
  responseCode?: string;
  responseMessage?: string;
  success?: boolean;
  elapsed?: number;
  latency?: number;
  timestamp?: number;
  thread?: string;
  url?: string;
  method?: string;
  queryString?: string;
  cookies?: string;
  requestHeader?: string;
  samplerData?: string;
  responseHeader?: string;
  responseData?: string;
  requestData?: string;
  bodyTruncated?: boolean;
  assertions?: AssertionResult[];
  subResults?: SampleResult[];
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  filePath?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface TestRun {
  id: string;
  jmxPath: string;
  startedAt: number;
  completedAt?: number;
  summary: RunSummary;
  samples: SampleResult[];
  jtlPath?: string;
  logPath?: string;
}
