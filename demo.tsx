"use client"

import HalftoneWordmarkFooter from "@/components/ui/halftone-wordmark-footer"

export default function Demo() {
  return (
    <div className="w-full bg-[#060911] text-white min-h-screen flex flex-col justify-between">
      <header className="p-8 border-b border-cyan-500/20 text-center">
        <h1 className="text-3xl font-black font-mono tracking-widest text-cyan-400">
          I/NET PORTAL
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Preview of Halftone Wordmark Footer for InfiNet
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center p-12 text-center text-slate-500">
        <p>Наведите курсор на точки внизу и кликните для ударной волны</p>
      </main>

      <HalftoneWordmarkFooter
        wordmark="infinet"
        label="InfiNet Community"
        meta="© 2024–2026 · DDNet Servers (82.148.243.178)"
        height="560px"
      />
    </div>
  )
}
