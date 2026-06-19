import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Pre-process text to convert common plain-text scientific/mathematical
 * annotations into proper unicode equivalents before markdown rendering.
 */
function preprocessScientificNotation(text: string): string {
  return text
    // Subscript numbers after chemical element symbols: H2O → H₂O, CO2 → CO₂
    .replace(/\b([A-Z][a-z]?)(\d+)\b/g, (match, elem, digits) => {
      // Only apply to known element patterns (single/double char followed by digits)
      if (/^[A-Z][a-z]?$/.test(elem)) {
        const subscriptDigits = digits
          .split('')
          .map((d: string) => String.fromCharCode(0x2080 + parseInt(d, 10)))
          .join('');
        return elem + subscriptDigits;
      }
      return match;
    })
    // Superscript exponents: x^2 → x², x^(n+1) → xⁿ⁺¹
    .replace(/\^(\d+|\w)/g, (match, exp: string) => {
      const superscriptMap: Record<string, string> = {
        '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3',
        '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077',
        '8': '\u2078', '9': '\u2079', 'n': '\u207F', '+': '\u207A',
        '-': '\u207B', '=': '\u207C', '(': '\u207D', ')': '\u207E',
        'i': '\u2071',
      };
      const result = exp
        .split('')
        .map((ch: string) => superscriptMap[ch] || ch)
        .join('');
      return result;
    })
    // Subscript notation like H_2 → H₂
    .replace(/_(\d+)/g, (match, digits: string) => {
      return digits
        .split('')
        .map((d: string) => String.fromCharCode(0x2080 + parseInt(d, 10)))
        .join('');
    })
    // Degree symbols: "degrees C" → °C
    .replace(/\bdegrees?\s*([CFK])\b/gi, '\u00B0$1')
    // Fractions like "1/2" → ½ (common ones)
    .replace(/\b(1\/2|1\/3|2\/3|1\/4|3\/4|1\/8|3\/8|5\/8|7\/8)\b/g, (match) => {
      const fractions: Record<string, string> = {
        '1/2': '\u00BD',
        '1/3': '\u2153',
        '2/3': '\u2154',
        '1/4': '\u00BC',
        '3/4': '\u00BE',
        '1/8': '\u215B',
        '3/8': '\u215C',
        '5/8': '\u215D',
        '7/8': '\u215E',
      };
      return fractions[match] || match;
    })
    // Arrows: -> → →, <- → ←, => → ⇒
    .replace(/->/g, '\u2192')
    .replace(/<-/g, '\u2190')
    .replace(/=>/g, '\u21D2')
    .replace(/<=/g, '\u21D0')
    // Multiplication dot: " x " between numbers → ×
    .replace(/(\d+)\s*x\s*(\d+)/g, '$1\u00D7$2')
    // Plus/minus
    .replace(/\+\/-/g, '\u00B1')
    .replace(/\+-/g, '\u00B1')
    // Greek letter approximations: alpha, beta, etc.
    .replace(/\b(alpha|Alpha)\b/g, (m) => m === 'alpha' ? '\u03B1' : '\u0391')
    .replace(/\b(beta|Beta)\b/g, (m) => m === 'beta' ? '\u03B2' : '\u0392')
    .replace(/\b(gamma|Gamma)\b/g, (m) => m === 'gamma' ? '\u03B3' : '\u0393')
    .replace(/\b(delta|Delta)\b/g, (m) => m === 'delta' ? '\u03B4' : '\u0394')
    .replace(/\b(theta|Theta)\b/g, (m) => m === 'theta' ? '\u03B8' : '\u0398')
    .replace(/\b(lambda|Lambda)\b/g, (m) => m === 'lambda' ? '\u03BB' : '\u039B')
    .replace(/\b(mu|Mu)\b/g, (m) => m === 'mu' ? '\u03BC' : '\u039C')
    .replace(/\b(pi|Pi)\b/g, (m) => m === 'pi' ? '\u03C0' : '\u03A0')
    .replace(/\b(sigma|Sigma)\b/g, (m) => m === 'sigma' ? '\u03C3' : '\u03A3')
    .replace(/\b(omega|Omega)\b/g, (m) => m === 'omega' ? '\u03C9' : '\u03A9');
}

interface FormattedTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text as proper formatted content:
 * - Markdown (bold, italic, code, lists, headings, tables)
 * - Scientific/mathematical unicode conversions
 * - Syntax-highlighted code blocks
 */
const FormattedText: React.FC<FormattedTextProps> = ({ text, className = '' }) => {
  const processedText = preprocessScientificNotation(text);

  return (
    <div className={`formatted-text ${className}`}>
      <ReactMarkdown
        components={{
          // Bold
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          // Italic
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          // Inline code
          code: ({ className: codeClassName, children, ...props }) => {
            // Fenced code blocks have a className like "language-xxx"
            if (codeClassName) {
              const language = codeClassName.replace(/^language-/, '');
              // Remove trailing newline from the code string
              const codeString = String(children).replace(/\n$/, '');
              return (
                <div className="my-3 rounded-lg overflow-hidden border border-secondary-200 text-sm">
                  {/* Language label bar */}
                  {language && (
                    <div className="flex items-center justify-between px-3 py-1 bg-secondary-50 border-b border-secondary-200">
                      <span className="text-[10px] font-mono text-secondary-500 uppercase tracking-wider">
                        {language}
                      </span>
                    </div>
                  )}
                  <SyntaxHighlighter
                    style={oneLight}
                    language={language || 'text'}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: language ? '0 0 0.5rem 0.5rem' : '0.5rem',
                      padding: '1rem',
                      fontSize: '0.8125rem',
                      lineHeight: '1.5',
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }
            // Inline code
            return (
              <code
                className="px-1.5 py-0.5 bg-secondary-100 rounded text-[0.85em] font-mono text-secondary-800"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Fenced code blocks: pre just passes through to the code component
          pre: ({ children }) => <>{children}</>,
          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-4 mb-2 text-secondary-900">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mt-3 mb-1.5 text-secondary-900">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-3 mb-1 text-secondary-900">{children}</h3>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-1.5 space-y-0.5 text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-1.5 space-y-0.5 text-sm">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-secondary-800">{children}</li>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{children}</p>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="my-3 border-secondary-200" />
          ),
          // Tables
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full text-sm border-collapse border border-secondary-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary-50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody>{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-secondary-200 last:border-b-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-secondary-700 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-secondary-800">{children}</td>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-primary-300 pl-3 py-0.5 my-2 text-secondary-600 italic">
              {children}
            </blockquote>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-800 underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedText;