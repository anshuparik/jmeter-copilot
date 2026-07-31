import * as fs from 'fs';
import { SampleResult, AssertionResult } from '../model/types';

const XMLParser = require('fast-xml-parser');

function decodeEntities(value: string): string {
  if (!value) return value;
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&');
}

function toString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return decodeEntities(value);
  return String(value);
}

function toNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return undefined;
}

function mapAssertion(node: any): AssertionResult {
  return {
    name: toString(node?.name),
    failure: toBoolean(node?.failure),
    failureMessage: toString(node?.failureMessage),
    success: toBoolean(node?.success)
  };
}

function mapSample(node: any): SampleResult {
  const assertionResults = Array.isArray(node?.assertionResult)
    ? node.assertionResult.map(mapAssertion)
    : node?.assertionResult
      ? [mapAssertion(node.assertionResult)]
      : [];

  const subResults = Array.isArray(node?.httpSample)
    ? node.httpSample.map(mapSample)
    : node?.httpSample
      ? [mapSample(node.httpSample)]
      : [];

  return {
    label: toString(node?.lb),
    responseCode: toString(node?.rc),
    responseMessage: toString(node?.rm),
    success: toBoolean(node?.s),
    elapsed: toNumber(node?.t),
    latency: toNumber(node?.lt),
    timestamp: toNumber(node?.ts),
    thread: toString(node?.tn),
    url: toString(node?.java.net.URL) || toString(node?.url),
    method: toString(node?.method),
    queryString: toString(node?.queryString),
    cookies: toString(node?.cookies),
    requestHeader: toString(node?.requestHeader),
    samplerData: toString(node?.samplerData),
    responseHeader: toString(node?.responseHeader),
    responseData: toString(node?.responseData),
    requestData: toString(node?.requestData),
    assertions: assertionResults,
    subResults
  };
}

export class JtlParser {
  public static parseString(content: string): SampleResult[] {
    const normalized = content.trim();
    const safeContent = normalized.endsWith('</testResults>') ? normalized : `${normalized}</testResults>`;
    const options = {
      ignoreAttributes: false,
      attributeNamePrefix: '',
      preserveOrder: false,
      processEntities: false,
      textNodeName: '_text',
      arrayMode: true,
      stopNodes: ['testResults']
    };

    const parsed = XMLParser.parse(safeContent, options);
    const samples = Array.isArray(parsed?.sample)
      ? parsed.sample.map(mapSample)
      : parsed?.sample
        ? [mapSample(parsed.sample)]
        : [];
    return samples;
  }

  public static parseFile(filePath: string): SampleResult[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return this.parseString(content);
  }
}
