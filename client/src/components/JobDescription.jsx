const BULLET = /^\s*[-•*]\s+/;
const isBullet = (line) => BULLET.test(line);

// Employers type plain text. Blocks separated by a blank line become paragraphs; lines starting with "- " become
// lists; a short line directly above a list becomes its heading. Nothing is treated as HTML.
export function parseDescription(text) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.split('\n').map((l) => l.trimEnd()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const items = (ls) => ls.map((l) => l.replace(BULLET, ''));
      if (lines.every(isBullet)) return { type: 'list', items: items(lines) };
      if (lines.length > 1 && !isBullet(lines[0]) && lines[0].length <= 60 && lines.slice(1).every(isBullet)) {
        return { type: 'section', heading: lines[0], items: items(lines.slice(1)) };
      }
      return { type: 'paragraph', text: lines.join('\n') };
    });
}

const List = ({ items }) => (
  <ul className="list-disc space-y-1.5 pl-5 marker:text-sapphire">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

export default function JobDescription({ text }) {
  return (
    <div className="max-w-[66ch] space-y-4 font-serif text-[1.1rem] leading-8">
      {parseDescription(text).map((block, i) =>
        block.type === 'paragraph' ? (
          <p key={i} className="whitespace-pre-line">{block.text}</p>
        ) : block.type === 'list' ? (
          <List key={i} items={block.items} />
        ) : (
          <div key={i} className="pt-2">
            <h3 className="mb-2 font-sans text-base font-semibold">{block.heading}</h3>
            <List items={block.items} />
          </div>
        ),
      )}
    </div>
  );
}
