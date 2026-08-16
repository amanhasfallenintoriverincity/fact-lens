interface CitationLinkProps {
  source: string;
  url: string | null;
}

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export function CitationLink({ source, url }: CitationLinkProps) {
  const safeUrl = safeHttpUrl(url);
  const className = 'text-xs text-gray-500 mt-1 pl-6';

  if (!safeUrl) {
    return <p className={className}>출처: {source}</p>;
  }

  return (
    <a
      className={`${className} block underline decoration-gray-300 underline-offset-2 hover:text-blue-600`}
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      출처: {source}
    </a>
  );
}
