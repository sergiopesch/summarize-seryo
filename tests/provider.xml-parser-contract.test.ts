import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// Resolve the same transitive SDK that is loaded by our provider package, rather
// than testing a separate top-level parser that production might never use.
const localRequire = createRequire(import.meta.url)
const providerRequire = createRequire(localRequire.resolve('@mariozechner/pi-ai'))
const bedrockRequire = createRequire(providerRequire.resolve('@aws-sdk/client-bedrock-runtime'))
const { parseXmlBody, parseXmlErrorBody } = bedrockRequire('@aws-sdk/core') as {
  parseXmlBody: (body: Uint8Array, context: object) => Promise<unknown>
  parseXmlErrorBody: (body: Uint8Array, context: object) => Promise<unknown>
}

describe('provider SDK XML parser contract', () => {
  it('preserves text and entity decoding in normal SDK responses', async () => {
    await expect(
      parseXmlBody(
        Buffer.from('<Response><Value>42</Value><Label>A &amp; B</Label></Response>'),
        {}
      )
    ).resolves.toEqual({ Value: '42', Label: 'A & B' })
    await expect(parseXmlBody(new Uint8Array(), {})).resolves.toEqual({})
  })

  it('preserves the SDK error-message normalization', async () => {
    await expect(
      parseXmlErrorBody(
        Buffer.from(
          '<Response><Error><Code>AccessDenied</Code><Message>Denied</Message></Error></Response>'
        ),
        {}
      )
    ).resolves.toEqual({ Error: { Code: 'AccessDenied', Message: 'Denied', message: 'Denied' } })
  })

  it('keeps a normal declared entity working', async () => {
    await expect(
      parseXmlBody(
        Buffer.from(
          '<!DOCTYPE root [<!ENTITY marker "ordinary">]><root><value>&marker;</value></root>'
        ),
        {}
      )
    ).resolves.toEqual({ value: 'ordinary' })
  })

  it('does not treat a period in an entity name as a regex wildcard', async () => {
    const xml =
      '<!DOCTYPE root [<!ENTITY foo. "SYNTHETIC_REGEX_ENTITY">]><root><value>&fooX;</value></root>'
    let result: unknown
    try {
      result = await parseXmlBody(Buffer.from(xml), {})
    } catch (error) {
      // Rejecting the undefined entity is safe; the SDK must retain its normal
      // malformed-response diagnostic instead of replacing caller data.
      expect(error).toHaveProperty('$responseBodyText', xml)
      return
    }
    expect(result).toEqual({ value: '&fooX;' })
  })

  it('retains the SDK malformed-response diagnostic', async () => {
    const xml = '<Response><Value></Response>'
    await expect(parseXmlBody(Buffer.from(xml), {})).rejects.toHaveProperty(
      '$responseBodyText',
      xml
    )
  })
})
