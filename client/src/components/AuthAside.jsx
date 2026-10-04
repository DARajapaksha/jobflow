// Left panel of the login and register pages.
export default function AuthAside({ title, children }) {
  return (
    <aside className="on-dark hidden rounded-[2rem] bg-sapphire p-12 text-white lg:flex lg:flex-col lg:justify-between lg:rounded-br-[6rem]">
      <h2 className="max-w-sm text-4xl font-semibold leading-tight">{title}</h2>
      <div className="mt-16 space-y-4 text-lg text-white/90">{children}</div>
    </aside>
  );
}
