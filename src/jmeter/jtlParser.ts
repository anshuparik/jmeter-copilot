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

    if (this.isCsv(normalized)) {
      return this.parseCsv(normalized, maxResponseBytes);
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

  private static isCsv(content: string): boolean {
    const firstLine = content.split(/\r?\n/, 1)[0].toLowerCase();
    return firstLine.includes('timestamp') && firstLine.includes('elapsed') && firstLine.includes('responsecode');
  }

  private static parseCsv(content: string, maxResponseBytes?: number): SampleResult[] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      return [];
    }
    const headers = this.parseCsvLine(lines[0]).map((header) => header.trim());
    const column = (name: string) => headers.indexOf(name);
    const get = (fields: string[], name: string): string | undefined => {
      const idx = column(name);
      return idx >= 0 ? fields[idx] : undefined;
    };
    const maxBytes = maxResponseBytes ?? vscode.workspace.getConfiguration('jmeter').get<number>('maxResponseBytes', 100000);
    const samples: SampleResult[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseCsvLine(lines[i]);
      const rawBody = get(fields, 'responseData');
      let responseData: string | undefined = rawBody;
      let bodyTruncated = false;
      if (rawBody && rawBody.length > maxBytes) {
        responseData = rawBody.slice(0, maxBytes);
        bodyTruncated = true;
      }
      const successValue = get(fields, 'success');
      samples.push({
        label: get(fields, 'label'),
        responseCode: get(fields, 'responseCode'),
        responseMessage: get(fields, 'responseMessage'),
        success: successValue ? successValue.toLowerCase() === 'true' : undefined,
        elapsed: toNumber(get(fields, 'elapsed')),
        latency: toNumber(get(fields, 'Latency')) ?? toNumber(get(fields, 'latency')),
        timestamp: toNumber(get(fields, 'timeStamp')) ?? toNumber(get(fields, 'timestamp')),
        thread: get(fields, 'threadName'),
        url: get(fields, 'URL') ?? get(fields, 'url'),
        method: get(fields, 'method'),
        queryString: get(fields, 'queryString'),
        cookies: get(fields, 'cookies'),
        requestHeader: get(fields, 'requestHeader'),
        samplerData: get(fields, 'samplerData'),
        responseHeader: get(fields, 'responseHeader'),
        responseData,
        requestData: get(fields, 'requestData'),
        bodyTruncated,
        assertions: [],
        subResults: []
      });
    }

    return samples;
  }

  private static parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  }
}

