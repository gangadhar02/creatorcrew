import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownView({ children }: { children: string }) {
  return (
    <div className="prose prose-zinc max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-2 prose-h3:text-base prose-p:my-2 prose-li:my-0.5 prose-code:rounded prose-code:bg-[var(--border)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
