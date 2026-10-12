'use client';

import { useEffect, useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import init, { check_video_engine } from './wasm_video_core';

export default function Home() {
  const [engineStatus, setEngineStatus] = useState("Initializing Engine...");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // Trimmer State
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [trimmedVideoUrl, setTrimmedVideoUrl] = useState<string | null>(null);

  // Store the FFmpeg instance
  const ffmpegRef = useRef<any>(null);;

  useEffect(() => {
    // 1. Boot up our custom Rust Wasm bridge
    init().then(() => setEngineStatus(check_video_engine())).catch(console.error);
    
    // 2. Boot up the heavy FFmpeg Wasm engine
   const loadFFmpeg = async () => {
  // Create the instance only in the browser
  ffmpegRef.current = new FFmpeg();
  const ffmpeg = ffmpegRef.current;
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  setEngineStatus("WebAssembly Video Engine & FFmpeg Ready!");
};
    loadFFmpeg();
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setTrimmedVideoUrl(null);
    }
  };

  const handleTrim = async () => {
    if (!videoFile) return;
    setIsProcessing(true);
    const ffmpeg = ffmpegRef.current;

    try {
      // 1. Write the user's file to the WebAssembly in-memory file system
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

      // 2. Run the FFmpeg command to slice the video instantly
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', startTime.toString(),
        '-to', endTime.toString(),
        '-c', 'copy',
        'output.mp4'
      ]);

      // 3. Read the new file from memory and create a download URL
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data as any], { type: 'video/mp4' });
      setTrimmedVideoUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error("Trimming failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center py-12 bg-gray-900 text-white font-sans">
      <div className="w-full max-w-3xl space-y-8 px-4">
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">In-Browser Video Trimmer</h1>
          <p className="text-sm text-green-400 font-mono">Status: {engineStatus}</p>
        </div>

        {!videoUrl ? (
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <p className="mb-2 text-xl font-semibold">Click or drag a video to upload</p>
            </div>
            <input type="file" accept="video/mp4" className="hidden" onChange={handleFileUpload} />
          </label>
        ) : (
          <div className="space-y-6">
            <div className="bg-black rounded-lg overflow-hidden border border-gray-700">
              <video src={trimmedVideoUrl || videoUrl} controls className="w-full max-h-[500px]" />
            </div>
            
            {/* Trimming Controls */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Start Time (seconds)</label>
                  <input type="number" value={startTime} onChange={(e) => setStartTime(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" min="0" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">End Time (seconds)</label>
                  <input type="number" value={endTime} onChange={(e) => setEndTime(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" min="1" />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button onClick={() => { setVideoUrl(null); setVideoFile(null); setTrimmedVideoUrl(null); }} className="text-red-400 hover:text-red-300 text-sm font-semibold">
                  Start Over
                </button>
                <button onClick={handleTrim} disabled={isProcessing} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-bold transition-colors">
                  {isProcessing ? "Processing..." : "✂️ Trim Video"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}