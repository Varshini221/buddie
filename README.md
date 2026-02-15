🎤 EchoLearn

EchoLearn is a real-time AI speaking tutor that helps students learn by explaining concepts out loud instead of just rereading notes.

The app listens to student explanations, evaluates them in real time, and gives natural voice feedback to help guide learning.


🚀 Why EchoLearn?

Students are often told that the best way to understand something is to explain it. But in reality, most students either explain to friends at the same level or just talk to themselves — which means mistakes can go uncorrected.

At the same time, studying is becoming more passive with AI tools, where students read answers instead of working through concepts themselves.

EchoLearn was built to make studying more active, interactive, and closer to explaining material to a real tutor.


✨ Features

  🎙 Real-time speech input
  
  🧠 AI explanation evaluation
  
  🔊 Natural voice feedback
  
  ⚡ Real-time interruption when explanations go off track
  
  📜 Live transcript streaming
  
  🤖 Conversational tutoring experience


🛠 Tech Stack

  Framework & Language
  
  - Next.js
  
  - React
  
  - TypeScript
  
  - Node.js
  
  Styling
  
  - Tailwind CSS
  
  APIs & AI
  
  - Web Speech API (speech recognition)
  
  - Google Gemini API (explanation evaluation + feedback)
  
  - ElevenLabs API (text-to-speech voice generation)


🧠 How It Works
  
  1. User pastes notes or study material
  
  2. User explains concepts out loud
  
  3. Speech is converted to text in real time
  
  4. Transcript chunks are evaluated using AI
  
  5. If explanation is incorrect:
  
  - The system interrupts
  - Explains the mistake
  - Generates voice feedback
  
  6. User continues explaining with guidance


🏗 Getting Started
  Clone the repository
  git clone <your-repo-url>
  cd echolearn
  
  Install dependencies
  npm install
  
  Set up environment variables
  
  Create a .env.local file:
  
  GEMINI_API_KEY=your_key_here
  ELEVENLABS_API_KEY=your_key_here
  
  Run development server
  npm run dev
  
  
  Open:
  👉 http://localhost:3000

⚠ Challenges

- Handling real-time speech recognition errors

- Managing API limits and latency

- Designing natural-feeling interruption timing

- Syncing voice output with UI feedback



📚 What I Learned

- How to build real-time voice AI systems

- How to integrate the ElevenLabs text-to-speech API

- How to structure AI prompts for consistent responses

- How to handle imperfect speech transcripts


🔮 Future Improvements

- Custom tutor avatars

- Learning progress tracking

- Adaptive difficulty

- Multi-language support

- Classroom integration
