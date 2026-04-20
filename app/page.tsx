"use client";

import { useState, useRef, useEffect } from 'react';
import StadiumMap, { MarkerData } from '@/components/StadiumMap';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Info, Send, TriangleAlert, MapPin, Search } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

export default function Home() {
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Welcome to Venue Copilot! I can help you find the shortest lines and fastest exits. What are you looking for today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // For map integration
  const [activeLocation, setActiveLocation] = useState<MarkerData | null>(null);
  const [locationsList, setLocationsList] = useState<MarkerData[]>([]);

  // Filters
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('wait_asc');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const hotspotsRef = ref(db, 'venue/hotspots');
    const unsubscribe = onValue(hotspotsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedMarkers = Object.keys(data).map(key => ({
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
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
  };

  // Apply filters and sorting
  let filteredLocations = locationsList.filter(loc => filter === 'all' || loc.type === filter);
  if (sort === 'wait_asc') {
    filteredLocations.sort((a, b) => a.waitTime - b.waitTime);
  } else if (sort === 'wait_desc') {
    filteredLocations.sort((a, b) => b.waitTime - a.waitTime);
  }

  return (
    <div className="flex h-screen w-full bg-[#EAE8F2] overflow-hidden p-3 gap-3">
      
      {/* Left Sidebar Layout mimicking the image */}
      <Card className="w-[420px] h-full flex flex-col bg-[#1C1C1C] text-white border-none rounded-3xl overflow-hidden shadow-2xl z-10 shrink-0">
        
        {/* Header Section */}
        <div className="px-6 pt-8 pb-4 flex flex-col gap-6 shrink-0">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full w-8 h-8" aria-label="Go back">
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black" aria-hidden="true">
                <TriangleAlert className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg tracking-wide">Venue Copilot</span>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full w-8 h-8" aria-label="Information">
              <Info className="w-5 h-5" aria-hidden="true" />
            </Button>
          </div>

          {/* Tab/Filter options */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1">
              <span className="text-gray-400 text-xs block mb-1" id="filter-label">Show me:</span>
              <select 
                aria-labelledby="filter-label"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-[#2A2A2A] border border-white/10 text-white hover:bg-white/10 h-9 rounded-xl px-3 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
              >
                <option value="all">All Facilities</option>
                <option value="food">Food & Drinks</option>
                <option value="restroom">Restrooms</option>
                <option value="exit">Exits</option>
              </select>
            </div>
            <div className="flex-1">
              <span className="text-gray-400 text-xs block mb-1" id="sort-label">Sort by:</span>
              <select 
                aria-labelledby="sort-label"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full bg-[#2A2A2A] border border-white/10 text-white hover:bg-white/10 h-9 rounded-xl px-3 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
              >
                <option value="wait_asc">Shortest Wait</option>
                <option value="wait_desc">Longest Wait</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 px-4 pb-6 overflow-hidden flex flex-col min-h-0">
          {/* AI Chat Area */}
          <div className="flex flex-col gap-3 shrink-0">
            <div className="bg-[#232323] rounded-2xl p-4 border border-white/5 shadow-inner">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                AI Assistant
              </h3>
              <div className="flex flex-col gap-4 max-h-[250px] overflow-y-auto pr-2" role="log" aria-live="polite" aria-label="Chat messages" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-md ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-[#333] text-gray-100 rounded-tl-sm border border-white/5'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
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

            {/* Chat Input moved below chat window */}
            <form onSubmit={sendMessage} className="relative mt-1">
              <Input 
                aria-label="Chat message"
                placeholder="Ask about lines, exits, food..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
          </div>

          {/* List of Facilities */}
          <div className="flex flex-col gap-1 px-2 mt-4 overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 shrink-0">Live Status</h3>
            {filteredLocations.map((loc) => (
              <div 
                key={loc.id} 
                onClick={() => setActiveLocation(loc)}
                className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all shrink-0 ${
                  activeLocation?.id === loc.id ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xl">{loc.type === 'food' ? '🍔' : loc.type === 'restroom' ? '🚻' : '🚪'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white truncate">{loc.name}</h4>
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> 0.2 mi • <span className={loc.waitTime < 5 ? 'text-green-400' : loc.waitTime > 15 ? 'text-red-400' : 'text-yellow-400'}>
                      {loc.waitTime} min wait
                    </span>
                  </p>
                </div>
              </div>
            ))}
            {filteredLocations.length === 0 && (
              <div className="text-gray-500 text-sm py-4 text-center">No locations match your filter.</div>
            )}
          </div>
        </div>
      </Card>

      {/* Main Map Area */}
      <div className="flex-1 relative rounded-[32px] overflow-hidden shadow-2xl ring-1 ring-black/5 bg-[#1C1C1C]">
        <StadiumMap activeLocation={activeLocation} onLocationSelect={setActiveLocation} locationsList={locationsList} />
      </div>

    </div>
  );
}

