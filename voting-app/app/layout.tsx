import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Instrument_Serif } from "next/font/google"
import "./globals.css"
import { AppKitProvider } from "@/contexts/appkit"
import { Web3Provider } from "@/contexts/web3-context"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" })

export const metadata: Metadata = {
  title: "Confidential Voting DApp",
  description: "Privacy-preserving voting application using Fhenix CoFHE",
}

// viewportFit cover lets the bottom bar respect phone safe areas
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090b0a",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} ${serif.variable}`}>
        <AppKitProvider>
          <Web3Provider>
            {children}
            <Toaster />
          </Web3Provider>
        </AppKitProvider>
      </body>
    </html>
  )
}
