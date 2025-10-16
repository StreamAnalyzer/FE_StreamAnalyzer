
import { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import './App.css'

interface Message {
  id: number
  text: string
  isUser: boolean
  timestamp: Date
}

interface YoutubeSearchRequest {
  userQuery: string
}

// 유튜브 링크를 감지하고 클릭 가능한 링크로 변환하는 함수
const convertYoutubeLinks = (text: string): string => {
  const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g
  
  return text.replace(youtubeRegex, (match) => {
    const fullUrl = match.startsWith('http') ? match : `https://${match}`
    return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="youtube-link">${match}</a>`
  })
}

// 홈페이지 컴포넌트 (메인 페이지)
function HomePage() {
  const navigate = useNavigate()
  const [inputText, setInputText] = useState('')

  const handleStartQuestion = () => {
    const text = inputText.trim()
    if (!text) return
    const conversationId = uuidv4()
    navigate(`/chat/${conversationId}`, { state: { initialQuery: text } })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleStartQuestion()
    }
  }

  return (
    <div className="chatbot-container">
      <div className="logo-section">
        <div className="logo">
          <div className="logo-icon">S</div>
          <span className="logo-text">StreamAnalyzer</span>
        </div>
      </div>
      <div className="messages-container">
        <div className="welcome-section">
          <div className="welcome-title">풍월량 영상을 빠르게 찾는 챗봇</div>
          <div className="welcome-description">
            StreamAnalyzer가 풍월량의 다양한 영상들을 빠르게 검색하고 추천해드립니다.
          </div>
        </div>
      </div>
      <div className="input-section">
        <div className="input-container">
          <button className="attachment-btn" type="button">📎</button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="풍월량 영상에 대해 무엇을 알고 싶으세요?"
            className="message-input"
          />
          <div className="input-controls">
            <span className="auto-text">자동</span>
            <button className="voice-btn" type="button">🎤</button>
            <button 
              className="send-btn" 
              onClick={handleStartQuestion}
              disabled={!inputText.trim()}
              type="button"
            >
              ✈️
            </button>
          </div>
        </div>
      </div>
      <div className="footer">
        <p>StreamAnalyzer에게 메시지를 보냄으로써, 우리의 약관과 개인정보 보호정책에 동의합니다.</p>
      </div>
    </div>
  )
}

// 채팅 컴포넌트
function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { initialQuery?: string } }
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const didInitRef = useRef(false)

  const handleLogoClick = () => {
    navigate('/')
  }

  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim()
    if (!text || !conversationId) return

    const userMessage: Message = {
      id: Date.now(),
      text: text,
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const query = text
    setInputText('')
    setIsTyping(true)
    setIsStreaming(true)

    try {
      // 백엔드 API 호출
      const response = await fetch(`https://api.streamanalyzer.store/api/chatbot/searching?conversationId=${conversationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery: query
        } as YoutubeSearchRequest)
      })

      if (!response.ok) {
        throw new Error('API 호출 실패')
      }

      // Server-Sent Events 처리
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let botMessageText = ''

      const botMessage: Message = {
        id: Date.now() + 1,
        text: '',
        isUser: false,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.trim()) {
              console.log('받은 라인:', line) // 디버깅용
              
              // data: 접두사가 있는 경우 먼저 처리
              if (line.startsWith('data:')) {
                try {
                  const jsonString = line.slice(5) // "data:" 제거
                  const data = JSON.parse(jsonString)
                  
                  if (Array.isArray(data)) {
                    const newText = data.join('')
                    console.log('추가할 텍스트 (data: 접두사):', newText) // 디버깅용
                    botMessageText += newText
                    
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === botMessage.id 
                          ? { ...msg, text: botMessageText }
                          : msg
                      )
                    )
                  }
                } catch (parseError) {
                  console.error('data: 접두사 JSON 파싱 오류:', parseError)
                }
              } else {
                // 일반 JSON 파싱 시도
                try {
                  const data = JSON.parse(line)
                  console.log('파싱된 데이터:', data) // 디버깅용
                  
                  // message 필드가 있고 배열인 경우
                  if (data.message && Array.isArray(data.message)) {
                    const newText = data.message.join('')
                    console.log('추가할 텍스트:', newText) // 디버깅용
                    botMessageText += newText
                    
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === botMessage.id 
                          ? { ...msg, text: botMessageText }
                          : msg
                      )
                    )
                  }
                  // data 필드가 있는 경우
                  else if (data.data && Array.isArray(data.data)) {
                    const newText = data.data.join('')
                    console.log('추가할 텍스트 (data):', newText) // 디버깅용
                    botMessageText += newText
                    
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === botMessage.id 
                          ? { ...msg, text: botMessageText }
                          : msg
                      )
                    )
                  }
                } catch (e) {
                  console.log('JSON 파싱 실패:', e) // 디버깅용
                }
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('API 오류:', error)
      const errorMessage: Message = {
        id: Date.now() + 2,
        text: '죄송합니다. 검색 중 오류가 발생했습니다. 다시 시도해주세요.',
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
      setIsStreaming(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    const initialQuery = location.state?.initialQuery
    if (initialQuery) {
      navigate(window.location.pathname, { replace: true })
      // 초기 질문 전송 (StrictMode에서도 단 한 번만)
      handleSendMessage(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="chatbot-container">
      {/* 로고 영역 */}
      <div className="logo-section">
        <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">S</div>
          <span className="logo-text">StreamAnalyzer</span>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-section">
            <div className="welcome-title">풍월량 영상을 빠르게 찾는 챗봇</div>
            <div className="welcome-description">
              StreamAnalyzer가 풍월량의 다양한 영상들을 빠르게 검색하고 추천해드립니다.
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.isUser ? 'user' : 'bot'}`}>
                <div 
                  className="message-content"
                  dangerouslySetInnerHTML={{ 
                    __html: convertYoutubeLinks(message.text) 
                  }}
                />
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString('ko-KR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            ))}
            {(isTyping || isStreaming) && (
              <div className="message bot typing">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="input-section">
        <div className="input-container">
          <button className="attachment-btn" type="button">
            📎
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="풍월량 영상에 대해 무엇을 알고 싶으세요?"
            className="message-input"
            disabled={isStreaming}
          />
          <div className="input-controls">
            <span className="auto-text">자동</span>
            <button className="voice-btn" type="button" disabled={isStreaming}>
              🎤
            </button>
            <button 
              className="send-btn" 
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isStreaming}
              type="button"
            >
              ✈️
        </button>
          </div>
        </div>
      </div>

      {/* 하단 약관 */}
      <div className="footer">
        <p>StreamAnalyzer에게 메시지를 보냄으로써, 우리의 약관과 개인정보 보호정책에 동의합니다.</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat/:conversationId" element={<ChatPage />} />
      </Routes>
    </Router>
  )
}

export default App
