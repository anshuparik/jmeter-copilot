import * as fs from 'fs';
import * as vscode from 'vscode';
import { XMLParser } from 'fast-xml-parser';
import { SampleResult, AssertionResult } from '../model/types';

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
  if (typeof value === 'object' && value !== null && '_text' in value) {
    return decodeEntities(String((value as any)._text));
  }
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

function mapSample(node: any, maxBytes: number = 100000): SampleResult {
  const rawAssertions = node?.assertionResult;
  const assertionResults: AssertionResult[] = Array.isArray(rawAssertions)
    ? rawAssertions.map(mapAssertion)
    : rawAssertions
      ? [mapAssertion(rawAssertions)]
      : [];

  const rawHttp = node?.httpSample;
  const rawSample = node?.sample;

  const childHttp: any[] = Array.isArray(rawHttp) ? rawHttp : rawHttp ? [rawHttp] : [];
  const childSample: any[] = Array.isArray(rawSample) ? rawSample : rawSample ? [rawSample] : [];
  const allChildren = [...childHttp, ...childSample];

  const subResults: SampleResult[] = allChildren.map((c) => mapSample(c, maxBytes));

  let rawResponseBody = toString(node?.responseData);
  let bodyTruncated = false;
  if (rawResponseBody && rawResponseBody.length > maxBytes) {
    rawResponseBody = rawResponseBody.slice(0, maxBytes);
    bodyTruncated = true;
  }

  return {
    label: toString(node?.lb),
    responseCode: toString(node?.rc),
    responseMessage: toString(node?.rm),
    success: toBoolean(node?.s),
    elapsed: toNumber(node?.t),
    latency: toNumber(node?.lt),
    timestamp: toNumber(node?.ts),
    thread: toString(node?.tn),
    url: toString(node?.['java.net.URL']) || toString(node?.url),
    method: toString(node?.method),
    queryString: toString(node?.queryString),
    cookies: toString(node?.cookies),
    requestHeader: toString(node?.requestHeader),
    samplerData: toString(node?.samplerData),
    responseHeader: toString(node?.responseHeader),
    responseData: rawResponseBody,
    requestData: toString(node?.requestData),
    bodyTruncated,
    assertions: assertionResults,
    subResults
  };
}

export class JtlParser {
  public static parseString(content: string, maxResponseBytes?: number): SampleResult[] {
    let normalized = content.trim();
    if (!normalized) {
      return [];
    }

    if (!normalized.startsWith('<testResults')) {
      const idx = normalized.indexOf('<testResults');
      if (idx >= 0) {
        normalized = normalized.slice(idx);
      } else {
        normalized = `<testResults version="1.2">${normalized}`;
      }
    }

    if (!normalized.endsWith('</testResults>')) {
      const lastHttpClose = normalized.lastIndexOf('</httpSample>');
      const lastSampleClose = normalized.lastIndexOf('</sample>');
      const lastClose = Math.max(lastHttpClose >= 0 ? lastHttpClose + 13 : -1, lastSampleClose >= 0 ? lastSampleClose + 9 : -1);
      if (lastClose > 0) {
        normalized = `${normalized.slice(0, lastClose)}\n</testResults>`;
      } else {
        normalized = `${normalized}\n</testResults>`;
      }
    }

    const options = {
      ignoreAttributes: false,
      attributeNamePrefix: '',
      preserveOrder: false,
      processEntities: false,
      textNodeName: '_text',
      isArray: (name: string) => name === 'sample' || name === 'httpSample' || name === 'assertionResult'
    };

    try {
      const parser = new XMLParser(options);
      const parsed = parser.parse(normalized);
      const testResults = parsed?.testResults;
      if (!testResults) {
        return [];
      }

      const maxBytes = maxResponseBytes ?? vscode.workspace.getConfiguration('jmeter').get<number>('maxResponseBytes', 100000);

      const samplesList: any[] = [];
      if (Array.isArray(testResults.sample)) {
        samplesList.push(...testResults.sample);
      } else if (testResults.sample) {
        samplesList.push(testResults.sample);
      }

      if (Array.isArray(testResults.httpSample)) {
        samplesList.push(...testResults.httpSample);
      } else if (testResults.httpSample) {
        samplesList.push(testResults.httpSample);
      }

      return samplesList.map((node) => mapSample(node, maxBytes));
    } catch {
      return [];
    }
  }

  public static parseFile(filePath: string, maxResponseBytes?: number): SampleResult[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return this.parseString(content, maxResponseBytes);
  }
}

