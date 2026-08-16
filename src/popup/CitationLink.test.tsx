import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CitationLink } from './CitationLink';

describe('CitationLink', () => {
  it('검증 출처 URL을 안전한 새 탭 링크로 렌더링한다', () => {
    const html = renderToStaticMarkup(
      <CitationLink source="대한민국 정부" url="https://www.korea.go.kr/" />,
    );

    expect(html).toContain('<a');
    expect(html).toContain('href="https://www.korea.go.kr/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('출처: 대한민국 정부');
  });
});
