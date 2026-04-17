export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#222222] border border-[#333] rounded-xl p-8 shadow-2xl">
      {children}
    </div>
  )
}
