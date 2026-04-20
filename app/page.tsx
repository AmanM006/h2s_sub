"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import dynamic_import from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Info, Send, TriangleAlert, MapPin } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { FIREBASE_HOTSPOTS_PATH, API_ROUTES, FACILITY_EMOJI, SORT_OPTIONS, FILTER_ALL } from '@/lib/constants';
import type { MarkerData } from '@/components/StadiumMap';

/** Lazy-load the StadiumMap component to avoid blocking initial page render (LCP optimization) */
const StadiumMap = dynamic_import(() => import('@/components/StadiumMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#111111] text-white">
      <div className="flex flex-col items-center gap-2">
        <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading Map...</span>
      </div>
    </div>
  ),
});

/** Represents a single chat message in the AI assistant conversation */
interface ChatMessage {
  /** The role of the message sender */
  role: 'user' | 'assistant';
  /** The text content of the message */
  content: string;
}

/**
 * Memoized chat message bubble component.
 * Prevents re-renders of individual messages when the list updates.
 */
const ChatBubble = memo(function ChatBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-md ${
        msg.role === 'user'
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-[#333] text-gray-100 rounded-tl-sm border border-white/5'
      }`}>
        {msg.content}
      </div>
    </div>
  );
});

/**
 * Memoized venue hotspot list item component.
 * Prevents re-renders when sibling items are selected.
 */
const VenueHotspotItem = memo(function VenueHotspotItem({
  loc,
  isActive,
  onSelect,
}: {
  loc: MarkerData;
  isActive: boolean;
  onSelect: (loc: MarkerData) => void;
}) {
  const handleClick = useCallback(() => onSelect(loc), [loc, onSelect]);
  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Select ${loc.name}, ${loc.waitTime} minute wait`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all shrink-0 ${
        isActive ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'
      }`}
    >
      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0" aria-hidden="true">
        <span className="text-xl">{FACILITY_EMOJI[loc.type] || '📍'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-white truncate">{loc.name}</h4>
        <p className="text-sm text-gray-400 flex items-center gap-1">
          <MapPin className="w-3 h-3" aria-hidden="true" /> 0.2 mi • <span className={loc.waitTime < 5 ? 'text-green-400' : loc.waitTime > 15 ? 'text-red-400' : 'text-yellow-400'}>
            {loc.waitTime} min wait
          </span>
        </p>
      </div>
    </div>
  );
});

/**
 * Home page component for the Venue Copilot application.
 * Renders the AI chat sidebar, facility list, and interactive map.
 * Uses Firebase Realtime Database for live hotspot data.
 */
export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Welcome to Venue Copilot! I can help you find the shortest lines and fastest exits. What are you looking for today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeLocation, setActiveLocation] = useState<MarkerData | null>(null);
  const [locationsList, setLocationsList] = useState<MarkerData[]>([]);

  const [filter, setFilter] = useState<string>(FILTER_ALL);
  const [sort, setSort] = useState<string>(SORT_OPTIONS.WAIT_ASC);

  /** Scrolls the chat window to the latest message */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  /** Subscribe to Firebase Realtime Database for live hotspot updates */
  useEffect(() => {
    const hotspotsRef = ref(db, FIREBASE_HOTSPOTS_PATH);
    const unsubscribe = onValue(hotspotsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedMarkers: MarkerData[] = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setLocationsList(parsedMarkers);
      } else {
        setLocationsList([]);
      }
    }, (error) => {
      console.log("Firebase fetch error:", error);
    });
    return () => unsubscribe();
  }, []);

  /**
   * Sends a user message to the chat API and appends the AI response.
   * @param e - The form submission event
   */
  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch(API_ROUTES.CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, venueData: locationsList }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, locationsList]);

  /** Memoized filtered and sorted facility list to avoid recalculation on every render */
  const filteredLocations = useMemo(() => {
    const filtered = locationsList.filter(loc => filter === FILTER_ALL || loc.type === filter);
    return [...filtered].sort((a, b) =>
      sort === SORT_OPTIONS.WAIT_ASC ? a.waitTime - b.waitTime : b.waitTime - a.waitTime
    );
  }, [locationsList, filter, sort]);

  /** Stable callback for handling filter dropdown changes */
  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value), []);
  /** Stable callback for handling sort dropdown changes */
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSort(e.target.value), []);
  /** Stable callback for handling chat input changes */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value), []);
  /** Stable callback for selecting a location on the map or list */
  const handleLocationSelect = useCallback((loc: MarkerData | null) => setActiveLocation(loc), []);

  return (
    <div className="flex h-screen w-full bg-[#EAE8F2] overflow-hidden p-3 gap-3">

      {/* Left Sidebar — Semantic <aside> for navigation panel */}
      <aside aria-label="Venue Copilot navigation sidebar">
        <Card className="w-[420px] h-full flex flex-col bg-[#1C1C1C] text-white border-none rounded-3xl overflow-hidden shadow-2xl z-10 shrink-0">

          {/* Header */}
          <header className="px-6 pt-8 pb-4 flex flex-col gap-6 shrink-0">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full w-8 h-8" aria-label="Go back">
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black" aria-hidden="true">
                  <TriangleAlert className="w-6 h-6" />
                </div>
                <h1 className="font-bold text-lg tracking-wide">Venue Copilot</h1>
              </div>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full w-8 h-8" aria-label="View application information">
                <Info className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>

            {/* Filter & Sort Controls */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex-1">
                <label htmlFor="filter-select" className="text-gray-400 text-xs block mb-1">Show me:</label>
                <select
                  id="filter-select"
                  value={filter}
                  onChange={handleFilterChange}
                  className="w-full bg-[#2A2A2A] border border-white/10 text-white hover:bg-white/10 h-9 rounded-xl px-3 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                >
                  <option value="all">All Facilities</option>
                  <option value="food">Food &amp; Drinks</option>
                  <option value="restroom">Restrooms</option>
                  <option value="exit">Exits</option>
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="sort-select" className="text-gray-400 text-xs block mb-1">Sort by:</label>
                <select
                  id="sort-select"
                  value={sort}
                  onChange={handleSortChange}
                  className="w-full bg-[#2A2A2A] border border-white/10 text-white hover:bg-white/10 h-9 rounded-xl px-3 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                >
                  <option value="wait_asc">Shortest Wait</option>
                  <option value="wait_desc">Longest Wait</option>
                </select>
              </div>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 px-4 pb-6 overflow-hidden flex flex-col min-h-0">
            {/* AI Chat Section */}
            <section aria-label="AI Chat Assistant" className="flex flex-col gap-3 shrink-0">
              <div className="bg-[#232323] rounded-2xl p-4 border border-white/5 shadow-inner">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" aria-hidden="true"></span>
                  AI Assistant
                </h2>
                <div className="flex flex-col gap-4 max-h-[250px] overflow-y-auto pr-2" role="log" aria-live="polite" aria-label="Chat messages" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
                  {messages.map((msg, i) => (
                    <ChatBubble key={i} msg={msg} />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start" aria-label="AI is typing">
                      <div className="bg-[#333] p-3 rounded-2xl rounded-tl-sm border border-white/5 flex gap-1 items-center h-10">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form onSubmit={sendMessage} className="relative mt-1" aria-label="Send a message to the AI assistant">
                <Input
                  aria-label="Type your message to the AI assistant"
                  placeholder="Ask about lines, exits, food..."
                  value={input}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="w-full bg-[#2A2A2A] border-none rounded-xl h-12 pl-4 pr-12 text-white placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-indigo-500 shadow-inner"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  aria-label="Send message"
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 text-indigo-400 hover:text-indigo-300 hover:bg-transparent disabled:opacity-50"
                >
                  <Send className="w-5 h-5" aria-hidden="true" />
                </Button>
              </form>
            </section>

            {/* Facility List */}
            <section aria-label="Live facility status" className="flex flex-col gap-1 px-2 mt-4 overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 shrink-0">Live Status</h2>
              {filteredLocations.map((loc) => (
                <VenueHotspotItem key={loc.id} loc={loc} isActive={activeLocation?.id === loc.id} onSelect={handleLocationSelect} />
              ))}
              {filteredLocations.length === 0 && (
                <div className="text-gray-500 text-sm py-4 text-center" role="status">No locations match your filter.</div>
              )}
            </section>
          </div>
        </Card>
      </aside>

      {/* Main Map */}
      <section aria-label="Interactive venue map" className="flex-1 relative rounded-[32px] overflow-hidden shadow-2xl ring-1 ring-black/5 bg-[#1C1C1C]">
        <StadiumMap activeLocation={activeLocation} onLocationSelect={handleLocationSelect} locationsList={locationsList} />
      </section>

    </div>
  );
}
