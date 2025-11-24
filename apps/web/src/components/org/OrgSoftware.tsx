import { Download, Monitor, Folder, Zap, Apple, ServerIcon, CheckCircle2, Sparkles } from 'lucide-react';

const tools = [
  {
    name: 'ProofMesh Desktop',
    description: 'Full-featured desktop application with batch processing, real-time verification, and offline capabilities',
    icon: Monitor,
    gradient: 'from-blue-500 to-cyan-500',
    platforms: [
      { name: 'Windows', url: '#', size: '45.2 MB', icon: ServerIcon },
      { name: 'macOS', url: '#', size: '52.1 MB', icon: Apple },
      { name: 'Linux', url: '#', size: '48.3 MB', icon: Monitor }
    ],
    features: ['Batch stamping', 'Real-time verification', 'Offline mode', 'Dark mode UI']
  },
  {
    name: 'Folder Watcher',
    description: 'Automated monitoring service that stamps files instantly when added to watched directories',
    icon: Folder,
    gradient: 'from-emerald-500 to-green-500',
    platforms: [
      { name: 'Windows', url: '#', size: '12.5 MB', icon: ServerIcon },
      { name: 'macOS', url: '#', size: '14.2 MB', icon: Apple },
      { name: 'Linux', url: '#', size: '11.8 MB', icon: Monitor }
    ],
    features: ['Auto-stamp on creation', 'Real-time monitoring', 'Background service', 'Notification system']
  },
  {
    name: 'CLI Tool',
    description: 'Command-line interface for developers, perfect for CI/CD pipelines and automation workflows',
    icon: Zap,
    gradient: 'from-violet-500 to-purple-500',
    platforms: [
      { name: 'npm install', url: '#', size: '2.1 MB', icon: ServerIcon },
      { name: 'Standalone Binary', url: '#', size: '8.4 MB', icon: ServerIcon }
    ],
    features: ['Shell integration', 'Pipeline support', 'Batch operations', 'JSON output']
  }
];

export default function OrgSoftware() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(34, 197, 94, 0.1))' }}>
        <div className="card-title">
          <h2 className="flex items-center gap-3 text-2xl">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] flex items-center justify-center">
              <Download className="w-6 h-6 text-[#020617]" />
            </div>
            <div>
              <div>Download Tools</div>
              <p className="text-sm text-[#9ca3af] font-normal mt-1">Desktop applications and automation utilities</p>
            </div>
          </h2>
          <Sparkles className="w-6 h-6 text-[#0ea5e9]" />
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 gap-6">
        {tools.map((tool, idx) => (
          <div
            key={tool.name}
            className="card group relative"
            style={{ 
              animation: `fadeIn 0.5s ease ${idx * 0.1}s both`,
            }}
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-[#0ea5e9] to-[#22c55e] rounded-2xl opacity-0 group-hover:opacity-20 blur transition duration-500"></div>
            
            <div className="relative card-body">
              <div className="flex flex-col lg:flex-row items-start gap-6">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <tool.icon className="w-8 h-8 text-white" />
                </div>
                
                <div className="flex-1 space-y-4 w-full">
                  {/* Header */}
                  <div>
                    <h3 className="text-xl font-bold mb-2">{tool.name}</h3>
                    <p className="text-sm text-[#9ca3af] leading-relaxed">{tool.description}</p>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2">
                    {tool.features.map((feature) => (
                      <span
                        key={feature}
                        className="inline-flex items-center gap-1.5 text-xs bg-[#020617] border border-[#1f2937] rounded-full px-3 py-1.5 hover:border-[#0ea5e9] transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3 text-[#22c55e]" />
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Download Buttons */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {tool.platforms.map((platform) => (
                      <a
                        key={platform.name}
                        href={platform.url}
                        className="group/btn inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] text-[#020617] rounded-xl text-sm font-semibold hover:shadow-2xl hover:shadow-[#0ea5e9]/50 transition-all duration-300 hover:scale-105"
                      >
                        <platform.icon className="w-4 h-4" />
                        <div className="flex flex-col items-start">
                          <span>{platform.name}</span>
                          <span className="text-[10px] opacity-75 font-normal">{platform.size}</span>
                        </div>
                        <Download className="w-4 h-4 ml-2 group-hover/btn:animate-bounce" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Requirements */}
      <div className="card relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#0ea5e9]/10 to-[#22c55e]/10 blur-3xl"></div>
        <div className="relative">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <ServerIcon className="w-5 h-5 text-[#0ea5e9]" />
            System Requirements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#020617] border border-[#1f2937] rounded-xl p-5 hover:border-[#0ea5e9] transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] flex items-center justify-center">
                  <ServerIcon className="w-5 h-5 text-[#020617]" />
                </div>
                <span className="font-semibold text-base">Windows</span>
              </div>
              <div className="space-y-2 text-sm text-[#9ca3af]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>Windows 10 or later (64-bit)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>4GB RAM minimum</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>200MB free disk space</span>
                </div>
              </div>
            </div>

            <div className="bg-[#020617] border border-[#1f2937] rounded-xl p-5 hover:border-[#0ea5e9] transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] flex items-center justify-center">
                  <Apple className="w-5 h-5 text-[#020617]" />
                </div>
                <span className="font-semibold text-base">macOS</span>
              </div>
              <div className="space-y-2 text-sm text-[#9ca3af]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>macOS 11 Big Sur or later</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>4GB RAM minimum</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>200MB free disk space</span>
                </div>
              </div>
            </div>

            <div className="bg-[#020617] border border-[#1f2937] rounded-xl p-5 hover:border-[#0ea5e9] transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-[#020617]" />
                </div>
                <span className="font-semibold text-base">Linux</span>
              </div>
              <div className="space-y-2 text-sm text-[#9ca3af]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>Ubuntu 20.04+ / Debian 11+</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>4GB RAM minimum</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                  <span>200MB free disk space</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
