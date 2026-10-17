export function SiteFooter({ className = "pb-6" }: { className?: string }) {
  return (
    <footer
      className={`relative z-10 space-y-1.5 border-t border-white/[0.06] px-4 pt-6 text-center text-xs text-zinc-500 md:pb-6 ${className}`}
    >
      <p>© 2026 Confidential Voting. All rights reserved.</p>
      <p>Powered by Fhenix CoFHE · Fully Homomorphic Encryption on Sepolia</p>
      <p>
        Built by Observer ·{" "}
        <a href="https://x.com/0bserver_here" target="_blank" rel="noreferrer" className="text-zinc-300 hover:text-[#c5d9c2]">
          @0bserver_here
        </a>
      </p>
    </footer>
  )
}
