import React, { useState } from 'react';
import { 
  Users, Star, MessageCircle, Heart, Filter, Plus, Search, 
  Gauge, Car, Shield, Calendar, ArrowRight 
} from 'lucide-react';

// Design tokens from Stitch document
const colors = {
  primary: '#c7c6cb',
  onSurface: '#e5e2e1',
  onSurfaceVariant: '#c7c6cb',
  surface: '#141313',
  surfaceContainer: '#201f20',
  surfaceHigh: '#2a2a2a',
  outline: '#46464b',
};

interface BlogPost {
  id: number;
  title: string;
  author: string;
  vehicle: string;
  excerpt: string;
  tag: string;
  likes: number;
  comments: number;
  time: string;
  image?: string;
}

const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: "NÜRBURGRING_01 - 7:14.22 in the Type R",
    author: "Rohan Sharma",
    vehicle: "Honda Civic Type R",
    excerpt: "The chassis is incredibly composed through the esses. Full telemetry breakdown and what I would change for next season.",
    tag: "Track",
    likes: 142,
    comments: 38,
    time: "2h ago",
    image: "/autoflex-garage.jpg"
  },
  {
    id: 2,
    title: "M340i Long-Term: 18 Months, 28k km",
    author: "Priya Menon",
    vehicle: "BMW M340i",
    excerpt: "Real fuel economy, service costs, and the one thing I would change about the car after owning it for a year and a half.",
    tag: "Ownership",
    likes: 89,
    comments: 21,
    time: "yesterday",
  },
  {
    id: 3,
    title: "DIY Transmission Teardown on the Nightshade",
    author: "Arjun Patel",
    vehicle: "Custom V8 Build",
    excerpt: "Step-by-step photos and torque specs from rebuilding the Getrag 420G. Saved me over ₹1.8L at the shop.",
    tag: "Build",
    likes: 67,
    comments: 14,
    time: "3d ago",
  }
];

const creators = [
  { name: "Rohan Sharma", role: "Track Specialist", followers: "12.4k", vehicle: "Civic Type R", verified: true },
  { name: "Priya Menon", role: "Long-term Owner", followers: "8.9k", vehicle: "M340i", verified: true },
  { name: "Arjun Patel", role: "Builder", followers: "15.2k", vehicle: "Nightshade V8", verified: true },
];

export function PremiumAutoflex() {
  const [currentView, setCurrentView] = useState<'landing' | 'telemetry' | 'garage' | 'vault' | 'community' | 'discovery'>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(true); // demo
  const [communityFilter, setCommunityFilter] = useState<'all' | 'track' | 'ownership' | 'build'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const filteredPosts = blogPosts.filter(post => {
    const matchesFilter = communityFilter === 'all' || 
      (communityFilter === 'track' && post.tag === 'Track') ||
      (communityFilter === 'ownership' && post.tag === 'Ownership') ||
      (communityFilter === 'build' && post.tag === 'Build');
    
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.author.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const Nav = () => (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#141313]/95 backdrop-blur-xl border-b border-[#46464b]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('landing')}>
          <div className="w-7 h-7 bg-[#c7c6cb] text-[#141313] rounded flex items-center justify-center font-bold text-sm">A</div>
          <span className="font-semibold tracking-tight text-lg">AUTOFLEX</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-sm">
          {[
            { id: 'telemetry', label: 'Telemetry' },
            { id: 'garage', label: 'Garage' },
            { id: 'vault', label: 'Vault' },
            { id: 'community', label: 'Community' },
            { id: 'discovery', label: 'Discovery' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as any)}
              className={`px-4 py-2 rounded-full transition-colors ${currentView === item.id ? 'bg-[#201f20] text-[#c7c6cb]' : 'hover:bg-[#201f20]/60'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="text-sm text-[#c7c6cb]">Priya Menon</div>
          ) : (
            <button onClick={() => setIsAuthenticated(true)} className="px-4 py-1.5 text-sm rounded-lg bg-[#c7c6cb] text-[#141313] font-medium">Sign in</button>
          )}
        </div>
      </div>
    </nav>
  );

  // === LANDING (kept similar but updated style) ===
  const Landing = () => (
    <div className="min-h-screen bg-[#141313] pt-16">
      <div className="relative h-[92vh] flex items-center justify-center bg-black overflow-hidden">
        <img src="/autoflex-garage.jpg" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/80 to-[#141313]" />
        
        <div className="relative z-10 text-center px-6 max-w-3xl">
          <div className="uppercase tracking-[3px] text-xs text-[#c7c6cb] mb-4">EST 2024 • INDIA</div>
          <h1 className="font-display-lg text-6xl md:text-7xl tracking-[-2.5px] leading-none mb-6 text-white">
            Where passion<br />meets precision.
          </h1>
          <p className="max-w-md mx-auto text-lg text-[#c7c6cb] mb-8">
            The definitive platform for car owners. Telemetry, ownership records, community, and discovery.
          </p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => setCurrentView('community')} className="primary-btn px-8 py-3.5 rounded-xl flex items-center gap-2">
              Explore Community <ArrowRight size={18} />
            </button>
            <button onClick={() => setCurrentView('telemetry')} className="secondary-btn px-8 py-3.5 rounded-xl">View Telemetry</button>
          </div>
        </div>
      </div>
    </div>
  );

  // === COMMUNITY / BLOG (main part from the Stitch code) ===
  const Community = () => (
    <div className="min-h-screen bg-[#141313] pt-16 pb-20">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="section-title mb-1">CREATOR NETWORK</div>
            <h1 className="font-display-lg text-4xl tracking-[-1.5px]">Community</h1>
            <p className="text-[#c7c6cb] mt-1">Real stories. Real cars. Real owners.</p>
          </div>
          <button className="primary-btn px-6 py-3 rounded-xl flex items-center gap-2 self-start">
            <Plus size={18} /> Write Post
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { id: 'all', label: 'ALL' },
            { id: 'track', label: 'TRACK' },
            { id: 'ownership', label: 'OWNERSHIP' },
            { id: 'build', label: 'BUILDS' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setCommunityFilter(f.id as any)}
              className={`px-5 py-1.5 rounded-full text-sm transition-all ${communityFilter === f.id 
                ? 'bg-[#c7c6cb] text-[#141313]' 
                : 'border border-[#46464b] hover:border-[#c7c6cb]/50'}`}
            >
              {f.label}
            </button>
          ))}
          
          <div className="flex-1" />
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-3 text-[#c7c6cb]" size={18} />
            <input
              type="text"
              placeholder="Search posts or creators..."
              className="w-full bg-[#201f20] border border-[#46464b] rounded-xl pl-11 py-2.5 text-sm focus:outline-none focus:border-[#c7c6cb]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Featured Creators */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">Featured Creators</div>
            <span className="text-sm text-[#c7c6cb] cursor-pointer">See all →</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creators.map((creator, i) => (
              <div key={i} className="bg-[#201f20] border border-[#46464b] rounded-2xl p-5 flex gap-4">
                <div className="w-14 h-14 rounded-full bg-[#c7c6cb]/10 flex-shrink-0" />
                <div>
                  <div className="font-medium flex items-center gap-1.5">
                    {creator.name} {creator.verified && <Star size={14} className="text-[#c7c6cb]" />}
                  </div>
                  <div className="text-sm text-[#c7c6cb]">{creator.role} • {creator.vehicle}</div>
                  <div className="text-xs mt-1 text-[#c7c6cb]/70">{creator.followers} followers</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Blog Feed */}
        <div className="section-title mb-4">Recent Posts</div>
        <div className="grid md:grid-cols-2 gap-6">
          {filteredPosts.length > 0 ? (
            filteredPosts.map(post => (
              <div 
                key={post.id} 
                className="post-card bg-[#201f20] border border-[#46464b] rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                {post.image && (
                  <div className="h-48 bg-black">
                    <img src={post.image} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-3 py-1 bg-[#c7c6cb]/10 text-[#c7c6cb] rounded-full">{post.tag}</span>
                    <span className="text-xs text-[#c7c6cb]/60">{post.time}</span>
                  </div>
                  
                  <h3 className="font-semibold text-xl tracking-tight leading-tight mb-2">{post.title}</h3>
                  <p className="text-sm text-[#c7c6cb] line-clamp-2 mb-4">{post.excerpt}</p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{post.author}</span>
                      <span className="text-[#c7c6cb]/70"> • {post.vehicle}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[#c7c6cb]">
                      <div className="flex items-center gap-1"><Heart size={16} /> {post.likes}</div>
                      <div className="flex items-center gap-1"><MessageCircle size={16} /> {post.comments}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-12 text-[#c7c6cb]">No posts found.</div>
          )}
        </div>

        {/* Digital Pit Lane / Recent Logs (from Stitch) */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="section-title">DIGITAL PIT LANE</div>
            <div className="flex-1 h-px bg-[#46464b]" />
          </div>
          
          <div className="bg-[#201f20] border border-[#46464b] rounded-2xl p-1">
            {[
              { icon: Gauge, title: "NÜRBURGRING_01", meta: "7:14.22", type: "Track Log" },
              { icon: Car, title: "TRANSMISSION_TEARDOWN", meta: "MAINTENANCE", type: "Build Log" },
              { icon: Shield, title: "WEEKEND_AT_BIC", meta: "3:42.18", type: "Track Log" },
            ].map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 hover:bg-[#2a2a2a] rounded-xl cursor-pointer">
                <div className="flex items-center gap-4">
                  <log.icon className="text-[#c7c6cb]" size={22} />
                  <div>
                    <div className="font-mono text-sm">{log.title}</div>
                    <div className="text-xs text-[#c7c6cb]/70">{log.meta}</div>
                  </div>
                </div>
                <div className="text-xs px-3 py-1 bg-[#c7c6cb]/10 rounded">{log.type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6" onClick={() => setSelectedPost(null)}>
          <div className="bg-[#201f20] border border-[#46464b] rounded-3xl max-w-2xl w-full p-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div>
                <span className="text-xs px-3 py-1 bg-[#c7c6cb]/10 text-[#c7c6cb] rounded-full">{selectedPost.tag}</span>
              </div>
              <button onClick={() => setSelectedPost(null)} className="text-[#c7c6cb]">Close</button>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight mb-2">{selectedPost.title}</h2>
            <div className="text-[#c7c6cb] mb-6">by {selectedPost.author} • {selectedPost.vehicle} • {selectedPost.time}</div>
            
            <div className="prose prose-invert text-[#e5e2e1]">
              {selectedPost.excerpt}
              <p className="mt-4">Full post content would go here in a real implementation — telemetry data, photos, comments thread, etc.</p>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t border-[#46464b]">
              <button className="flex-1 py-3 rounded-xl bg-[#c7c6cb] text-[#141313] font-medium">Like • {selectedPost.likes}</button>
              <button className="flex-1 py-3 rounded-xl border border-[#46464b]">Comment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Simple placeholders for other pages (you can expand similarly)
  const Telemetry = () => <div className="pt-20 p-8 max-w-5xl mx-auto"><h1 className="font-display-lg">Telemetry</h1><p className="text-[#c7c6cb]">Live metrics dashboard coming from the Stitch reference.</p></div>;
  const Garage = () => <div className="pt-20 p-8 max-w-5xl mx-auto"><h1 className="font-display-lg">My Garage</h1><p className="text-[#c7c6cb]">Curated builds and vehicle cards in the new style.</p></div>;
  const Vault = () => <div className="pt-20 p-8 max-w-5xl mx-auto"><h1 className="font-display-lg">Document Vault</h1><p className="text-[#c7c6cb]">Secure documents interface.</p></div>;
  const Discovery = () => <div className="pt-20 p-8 max-w-5xl mx-auto"><h1 className="font-display-lg">Discovery</h1><p className="text-[#c7c6cb]">Browse and compare cars.</p></div>;

  return (
    <div className="bg-[#141313] text-[#e5e2e1] min-h-screen">
      <Nav />
      {currentView === 'landing' && <Landing />}
      {currentView === 'community' && <Community />}
      {currentView === 'telemetry' && <Telemetry />}
      {currentView === 'garage' && <Garage />}
      {currentView === 'vault' && <Vault />}
      {currentView === 'discovery' && <Discovery />}

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#141313] border-t border-[#46464b] z-50">
        <div className="flex justify-around text-xs py-2">
          {[
            {id:'community', label:'Community', icon:Users},
            {id:'telemetry', label:'Telemetry', icon:Gauge},
            {id:'garage', label:'Garage', icon:Car},
            {id:'discovery', label:'Discover', icon:Search},
          ].map(item => (
            <button key={item.id} onClick={() => setCurrentView(item.id as any)} className={`flex flex-col items-center ${currentView === item.id ? 'text-[#c7c6cb]' : ''}`}>
              <item.icon size={20} />
              <span className="mt-0.5">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
