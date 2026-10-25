import { describe, expect, it } from 'vitest'

import {
  prepareMarkdownForTerminal,
  prepareMarkdownForTerminalStreaming,
  prepareMarkdownLineForTerminal,
} from '../src/run/markdown.js'

describe('terminal Markdown output contract', () => {
  it('keeps a source URL visible without turning image markup into a text citation', () => {
    expect(
      prepareMarkdownLineForTerminal(
        'Read [ Source ](https://example.com/article) and ![chart](https://example.com/chart.png).'
      )
    ).toBe('Read Source: https://example.com/article and ![chart](https://example.com/chart.png).')
    expect(prepareMarkdownLineForTerminal('[   ](https://example.com)')).toBe(
      '[   ](https://example.com)'
    )
  })

  it('resolves case-insensitive and collapsed reference citations and retains unused definitions', () => {
    const result = prepareMarkdownForTerminal(
      '[Guide][ DOCS ] and [docs][]\n\n[docs]: https://example.com/guide\n[unused]: https://example.com/unused'
    )
    expect(result).toBe(
      'Guide: https://example.com/guide and docs: https://example.com/guide\n\n[unused]: https://example.com/unused'
    )
  })

  it('preserves unresolved references instead of inventing or deleting their targets', () => {
    const input = '[Missing][unknown]\n\n[other]: https://example.com/other'
    expect(prepareMarkdownForTerminal(input)).toBe(input)
    expect(prepareMarkdownForTerminal('[Missing][unknown]')).toBe('[Missing][unknown]')
  })

  it('keeps streaming output append-only when a reference definition arrives later', () => {
    const prefix = 'Read [Guide][docs]'
    expect(prepareMarkdownForTerminalStreaming(prefix)).toBe(prefix)
    expect(
      prepareMarkdownForTerminalStreaming(`${prefix}\n\n[docs]: https://example.com/guide`)
    ).toBe(`${prefix}\n\n[docs]: https://example.com/guide`)
  })

  it('preserves literal links and blank lines inside code fences while normalizing prose', () => {
    const input = [
      'Introduction',
      '',
      '',
      '```md',
      '[literal](https://example.com/code)',
      '',
      '',
      '```',
      '',
      '',
      'Read [Guide](https://example.com/guide)',
    ].join('\r\n')
    const expected = [
      'Introduction',
      '',
      '```md',
      '[literal](https://example.com/code)',
      '',
      '',
      '```',
      '',
      'Read Guide: https://example.com/guide',
    ].join('\n')
    expect(prepareMarkdownForTerminal(input)).toBe(expected)
    expect(prepareMarkdownForTerminalStreaming(input)).toBe(expected)
  })
})
