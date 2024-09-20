import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { initializeApp } from 'firebase/app';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
import { FaPlay, FaReadme, FaSignOutAlt, FaCloudDownloadAlt, FaHeadphones } from 'react-icons/fa';
import './App.css';
import { getFirestore, collection, where, getDocs, query, orderBy, startAfter, limit } from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';

const speechKey = process.env.REACT_APP_AZURE_SPEECH_API_KEY;
const serviceRegion = 'eastus';
const voiceName = 'en-US-AvaNeural';
let searchText = '';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const App = () => {
  // **State Variables**
  const [genaiData, setGenaiData] = useState([]);
  const [dataLimit, setDataLimit] = useState(11);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastVisible, setLastVisible] = useState(null); // State for the last visible document
  const [language, setLanguage] = useState("en");

  // Authentication state
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uid, setUid] = useState(null);
  const [model, setModel] = useState('openai');

  // **New State Variables for Generate Functionality**
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false); 
  const [isGeneratingGemini, setIsGeneratingGemini] = useState(false);
  const [isGeneratingAnthropic, setIsGeneratingAnthropic] = useState(false); 
  const [isOpenAI, setIsOpenAI] = useState(false);
  const [isAnthropic, setIsAnthropic] = useState(false);
  const [isGemini, setIsGemini] = useState(true);

  // Helper function to get URL parameters
  const getUrlParameter = (name) => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    return urlParams.get(name);
  };

  const questionLimit = getUrlParameter('question_limit');
  const telugu = getUrlParameter('telugu');
  const hindi = getUrlParameter('hindi');

  // Helper function to truncate questions based on limit
  const getQuestionSubstring = (question) => {
    if (questionLimit) {
      return question.substring(0, parseInt(questionLimit));
    }
    return question;
  };

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setUid(currentUser.uid);
        console.log('User is signed in:', currentUser.uid);
        // Fetch data for the authenticated user
        await fetchData(currentUser.uid);
      }
      else {
        console.log('No user is signed in');
      }
    });
    return () => unsubscribe();
  }, []);

  // Function to fetch data from Firestore
  const fetchData = async (userID) => {
    try {
      const genaiCollection = collection(db, 'genai', userID, 'MyGenAI');
      let q;
      q = query(genaiCollection, orderBy('createdDateTime', 'desc'), limit(dataLimit));
      if (hindi) {
        q = query(genaiCollection, orderBy('createdDateTime', 'desc'), where('language', '==', 'Hindi'), limit(dataLimit));
      }
      if (telugu) {
        q = query(genaiCollection, orderBy('createdDateTime', 'desc'), where('language', '==', 'Telugu'), limit(dataLimit));
      }
      const genaiSnapshot = await getDocs(q);
      const genaiList = genaiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGenaiData(genaiList);
      setLastVisible(genaiSnapshot.docs[genaiSnapshot.docs.length - 1]); // Set last visible document
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  // Effect to handle search queries
  useEffect(() => {
    if (searchQuery === "") return;
    setIsLoading(true);
    fetch(`https://us-central1-reviewtext-ad5c6.cloudfunctions.net/function-11?limit=12&q=${searchQuery.replace(/ /g, '-')}`)
      .then((res) => res.json())
      .then((data) => {
        setGenaiData(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Invalid JSON format:", error);
        setIsLoading(false);
      });
  }, [searchQuery]);

  // Handlers for input changes
  const handleLimitChange = (event) => {
    const newLimit = event.target.value ? parseInt(event.target.value) : 11;
    setDataLimit(newLimit);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const [showFullQuestion, setShowFullQuestion] = useState(false);

  const handleShowMore = () => {
    setShowFullQuestion(true);
  };

  // Helper function to split messages into chunks
  const splitMessage = (msg, chunkSize = 4000) => {
    const chunks = [];
    for (let i = 0; i < msg.length; i += chunkSize) {
      chunks.push(msg.substring(i, i + chunkSize));
    }
    return chunks;
  };

  // Function to synthesize speech
  const synthesizeSpeech = async (articles, language) => {
    const speechConfig = speechsdk.SpeechConfig.fromSubscription(speechKey, serviceRegion);
    speechConfig.speechSynthesisVoiceName = voiceName;
    if (language === "Spanish") {
      speechConfig.speechSynthesisVoiceName = "es-MX-DaliaNeural";
    }
    if (language === "Hindi") {
      speechConfig.speechSynthesisVoiceName = "hi-IN-SwaraNeural";
    }
    if (language === "Telugu") {
      speechConfig.speechSynthesisVoiceName = "te-IN-ShrutiNeural";
    }

    const audioConfig = speechsdk.AudioConfig.fromDefaultSpeakerOutput();
    const speechSynthesizer = new speechsdk.SpeechSynthesizer(speechConfig, audioConfig);

    const chunks = splitMessage(articles);
    for (const chunk of chunks) {
      try {
        const result = await speechSynthesizer.speakTextAsync(chunk);
        if (result.reason === speechsdk.ResultReason.SynthesizingAudioCompleted) {
          console.log(`Speech synthesized to speaker for text: [${chunk}]`);
        } else if (result.reason === speechsdk.ResultReason.Canceled) {
          const cancellationDetails = speechsdk.SpeechSynthesisCancellationDetails.fromResult(result);
          if (cancellationDetails.reason === speechsdk.CancellationReason.Error) {
            console.error(`Error details: ${cancellationDetails.errorDetails}`);
          }
        }
      } catch (error) {
        console.error(`Error synthesizing speech: ${error}`);
      }
    }
  };

  // Function to render question with 'More' button
  const renderQuestion = (question) => {
    if (showFullQuestion) {
      return <ReactMarkdown>{question}</ReactMarkdown>;
    } else {
      const truncatedQuestion = getQuestionSubstring(question);
      return (
        <div>
          <ReactMarkdown>{question.substring(0, parseInt(400))}</ReactMarkdown>
          <button onClick={handleShowMore}>More</button>
        </div>
      );
    }
  };

  // Function to fetch more data for pagination
  const fetchMoreData = async () => {
    try {
      // get auth user
      const user = auth.currentUser;
      if (!user) {
        console.error("No user is signed in");
        return;
      }
      else {
        console.log('User is signed in:', user.uid);
        const genaiCollection = collection(db, 'genai', user.uid, 'MyGenAI');
        let nextQuery;
        nextQuery = query(genaiCollection, orderBy('createdDateTime', 'desc'), startAfter(lastVisible), limit(dataLimit));
        if (hindi) {
          nextQuery = query(genaiCollection, orderBy('createdDateTime', 'desc'), where('language', '==', 'Hindi'), startAfter(lastVisible), limit(dataLimit));
        }
        if (telugu) {
          nextQuery = query(genaiCollection, orderBy('createdDateTime', 'desc'), where('language', '==', 'Telugu'), startAfter(lastVisible), limit(dataLimit));
        }

        const genaiSnapshot = await getDocs(nextQuery);
        const genaiList = genaiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGenaiData(prevData => [...prevData, ...genaiList]);
        setLastVisible(genaiSnapshot.docs[genaiSnapshot.docs.length - 1]); // Update last visible document
      }
    } catch (error) {
      console.error("Error fetching more data: ", error);
    }
  };

  // **Authentication Functions**

  // Sign In with Email and Password
  const handleSignInWithEmail = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;
      if (!loggedInUser.emailVerified) {
        await auth.signOut();
        alert('Please verify your email before signing in.');
      }
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        alert('Wrong password, please try again.');
      } else {
        alert('Error signing in: ' + error.message);
        console.error('Error signing in:', error);
      }
    }
  };

  // Sign Up with Email and Password
  const handleSignUpWithEmail = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(auth.currentUser);
      alert('Verification email sent! Please check your inbox. After verification, please sign in.');
      await auth.signOut();
    } catch (error) {
      alert('Error signing up: ' + error.message);
      console.error('Error signing up:', error);
    }
  };

  // Password Reset
  const handlePasswordReset = async () => {
    if (!email) {
      alert('Please enter your email address.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent, please check your inbox.');
    } catch (error) {
      console.error('Error sending password reset email:', error);
    }
  };

  // Sign In with Google
  const handleSignInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((error) => {
      console.error('Error signing in with Google:', error);
      alert('Error signing in with Google: ' + error.message);
    });
  };

  // Sign Out
  const handleSignOut = () => {
    signOut(auth).catch((error) => {
      console.error('Error signing out:', error);
      alert('Error signing out: ' + error.message);
    });
  };

  // **New Event Handlers for Generate and Refresh**

  // Handler for Generate Button Click
  const handleGenerate = async () => {
    if (!promptInput.trim()) {
      alert('Please enter a prompt.');
      return;
    }

    if (!isOpenAI && !isAnthropic && !isGemini) {
      alert('Please select a model.');
      return;
    }

    if (isAnthropic) {
      setIsGeneratingAnthropic(true); // Set generating state to true
      setModel('anthropic');
      callAPI('anthropic');
    }

    if (isGemini) {
      setIsGeneratingGemini(true); // Set generating state to true
      setModel('gemini');
      callAPI('gemini');
    }

    if (isOpenAI) {
      setIsGenerating(true); // Set generating state to true
      setModel('openai');
      callAPI('openai');
    }

};

  // Call the function13 api
  const callAPI = async (selectedModel) => {
    console.log('Calling API with model:', selectedModel);

    try {
      const response = await fetch('https://us-central1-reviewtext-ad5c6.cloudfunctions.net/function-13', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: promptInput, model: selectedModel, uid: uid })
      });
 
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content.');
      }

      const data = await response.json();
      console.log('Response:', data);
      // print response data.question
      console.log('Selected Model:', selectedModel);
      console.log('Response - Question:', data.question);
      
     const { model, firestoreStatus } = data.results[0];
      console.log('Model:', model);
      console.log('Firestore Status:', firestoreStatus);

    } catch (error) {
      console.error('Error generating content:', error);
      alert(`Error: ${error.message}`);
    } finally {
      // click refresh button
      console.log('Fetching data after generating content');
      fetchData(uid);
      if (selectedModel === 'openai') {
        setIsGenerating(false);
      }
      if (selectedModel === 'anthropic') {
        setIsGeneratingAnthropic(false);
      }
      if (selectedModel === 'gemini') {
        setIsGeneratingGemini(false);
      }
    }
  };

  // Handler for Refresh Button Click
  const handleRefresh = () => {
    fetchData(uid);
  };

  return (
    <div>
      {!user ? (
        // **Unauthenticated User Interface: Authentication Forms**
        <div style={{ fontSize: '22px', width: '100%', margin: '0 auto' }}>
          <br />
          <p>Sign In</p>
          <input
            className="textinput"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <br />
          <br />
          <input
            type="password"
            className="textinput"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <br />
          <br />
          <button className="signonpagebutton" onClick={handleSignInWithEmail}>
            Sign In
          </button>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <button className="signuppagebutton" onClick={handleSignUpWithEmail}>
            Sign Up
          </button>
          <br />
          <br />
          <button onClick={handlePasswordReset}>Forgot Password?</button>
          <br />
          <br />
          <br />
          <p> OR </p>
          <br />
          <button className="signgooglepagebutton" onClick={handleSignInWithGoogle}>
            Sign In with Google
          </button>
          <br />
        </div>
      ) : (
        // **Authenticated User Interface: Data Display and New Functionalities**
        <div>
          <div>
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Enter your prompt here..."
              style={{ width: '95%', padding: '8px', height: '40px', fontSize: '16px' }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label>
              <input
          type="checkbox"
          value="openai"
          onChange={(e) => setIsOpenAI(e.target.checked)}
          checked={isOpenAI}
              />
              OpenAI
            </label>
            <label style={{ marginLeft: '10px' }}>
              <input
          type="checkbox"
          value="anthropic"
          onChange={(e) => setIsAnthropic(e.target.checked)}
          checked={isAnthropic}
              />
              Anthropic
            </label>
            <label style={{ marginLeft: '10px' }}>
              <input
          type="checkbox"
          value="gemini"
          onChange={(e) => setIsGemini(e.target.checked)}
          checked={isGemini}
              />
              Gemini
            </label>
            <button
              onClick={handleGenerate}
              className="signonpagebutton"
              style={{ marginLeft: '60px', padding: '15px 20px', fontSize: '16px' }}
              disabled={isGenerating || isGeneratingGemini || isGeneratingAnthropic} // Disable button while generating
            >
              {isGenerating ? 'Generating OpenAI...' : isGeneratingGemini ? 'Generating Gemini...' : isGeneratingAnthropic ? 'Generating Anthropic...' : 'Generate'}
            </button>
            <button
              onClick={handleRefresh}
              className="signuppagebutton"
              style={{ marginLeft: '20px', padding: '10px 20px', fontSize: '16px' }}
              title="Refresh data" // Added hover text
            >
              <FaCloudDownloadAlt />
            </button>
            <button className="signoutbutton" onClick={handleSignOut} style={{ marginLeft: '40px', padding: '10px 20px', fontSize: '16px' }}>
              <FaSignOutAlt />
            </button>
          </div>

          {/* **Existing Components: Limit and Search Inputs, Sign Out Button** */}
          <label>
            Limit:
            <input
              type="number"
              value={dataLimit}
              onChange={handleLimitChange}
              style={{ width: "50px", margin: "0 10px" }}
              min={1}
            />
          </label>
          <input
            type="text"
            onKeyDown={(event) => event.key === "Enter" && handleSearchChange(event)}
            placeholder="Enter Search Text and Click Enter"
            defaultValue=""
            style={{ width: '80%', padding: '10px', fontSize: '16px' }}
          />

          {/* **Display Generated Response** 
          {generatedResponse && (
            <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '20px', borderRadius: '5px' }}>
              <h3>Response is generated, click Refresh button to see results</h3>
            </div>
          )}*/}

          {/* **Existing Data Display** */}
          <div>
            {isLoading && <p> Loading Data...</p>}
            {!isLoading && <div>
              {genaiData.map((item) => (
                <div key={item.createdDateTime}>
                  <h4 style={{ color: "brown" }}>
                    Time: <span style={{ color: "black", fontSize: "16px" }}>{new Date(item.createdDateTime).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}</span>
                    &nbsp;&nbsp;
                    Date: <span style={{ color: "grey", fontSize: "16px" }}>{new Date(item.createdDateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    &nbsp;&nbsp;&nbsp;&nbsp;
                    Model: <span style={{ color: "blue", fontSize: "16px" }}>{item.model}   </span>
                  </h4>
                  <div style={{ border: "1px dotted black", padding: "2px" }}>
                    <div style={{ textAlign: "center", color: "orange", fontWeight: "bold" }}>---Question--</div>
                    <div style={{ fontSize: '16px' }}>
                      {renderQuestion(item.question)}
                    </div>
                  </div>
                  <br />
                  <div style={{ border: "1px solid black", padding: "4px" }}>
                    <button className="signgooglepagebutton" onClick={() => synthesizeSpeech(item.answer, item.language || "English")}><FaHeadphones /></button>
                    <div style={{ textAlign: "center", color: "green", fontWeight: "bold" }}>---Answer--</div>
                    <div style={{ fontSize: '16px' }}>
                      <ReactMarkdown>{item.answer}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              <button className="fetchButton" onClick={fetchMoreData} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px' }}>
                Show more information
              </button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;