import React, { useState, useEffect } from "react";
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from "react-markdown";
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
import { FaPlay, FaReadme, FaArrowLeft, FaSignOutAlt, FaSpinner, FaCloudDownloadAlt, FaEdit, FaMarkdown, FaEnvelopeOpenText, FaHeadphones } from 'react-icons/fa';
import './GenAIApp.css';
import { collection, doc, where, addDoc, getDocs, query, orderBy, startAfter, limit, updateDoc } from 'firebase/firestore';
import {
    onAuthStateChanged,
    signOut,
} from 'firebase/auth';
import App from './App';
import { auth, db } from './Firebase';
import VoiceSelect from './VoiceSelect';
import { TbEmpathize } from "react-icons/tb";
import { MdSettingsInputComponent } from "react-icons/md";
import { FaK } from "react-icons/fa6";

const speechKey = process.env.REACT_APP_AZURE_SPEECH_API_KEY;
const serviceRegion = 'eastus';
const isiPhone = /iPhone/i.test(navigator.userAgent);
console.log(isiPhone);

let searchQuery = '';
let searchModel = 'All';
let dataLimit = 11;
let promptSuggestion = 'NA';
let autoPromptInput = '';

const GenAIApp = () => {
    // **State Variables**
    const [genaiData, setGenaiData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastVisible, setLastVisible] = useState(null); // State for the last visible document
    const [user, setUser] = useState(null);
    const [uid, setUid] = useState(null);
    const [promptInput, setPromptInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTTS, setIsTTS] = useState(false);
    const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
    const [voiceName, setVoiceName] = useState('en-US-AriaNeural');
    const [showMainApp, setShowMainApp] = useState(false);
    const [GenAIParameter, setGenAIParameter] = useState(false);
    const [fileName, setFileName] = useState('');
    const [docId, setDocId] = useState('');

    const embedPrompt = async (docId) => {
        try {
            console.log('Embedding prompt:', docId);
            const response = await fetch(`${process.env.REACT_APP_GENAI_API_URL}embed-prompt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ doc_id: docId, uid: uid , collection: 'notes', field1: 'fileName' , field2: 'promptInput'})
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to embed prompt.');
            }
            const data = await response.json();
            console.log('Embed Prompt Response:', data);
        } catch (error) {
            console.error('Error embedding prompt:', error);
            alert(`Error: ${error.message}`);
        }
    };

    // Listen for authentication state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const urlParams = new URLSearchParams(window.location.search);
                const genaiParam = urlParams.get('genai');
                if (genaiParam) {
                    setGenAIParameter(true);
                }
                if (process.env.REACT_APP_MAIN_APP === 'GenAI') {
                    setGenAIParameter(true);
                }
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
            const genaiCollection = collection(db, 'genai', userID, 'notes');
            let q;
            q = query(genaiCollection, orderBy('modifiedDateTime', 'desc'), limit(dataLimit));
            const genaiSnapshot = await getDocs(q);
            const genaiList = genaiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGenaiData(genaiList);
            setLastVisible(genaiSnapshot.docs[genaiSnapshot.docs.length - 1]); // Set last visible document
        } catch (error) {
            console.error("Error fetching data: ", error);
        }
    };

    // Handlers for input changes
    const handleLimitChange = (event) => {
        dataLimit = parseInt(event.target.value);
        bigQueryResults();
    };

    const handleSearchChange = (event) => {
        searchQuery = event.target.value;
        bigQueryResults();
    };

    const handleVectorSearchChange = (event) => {
        searchQuery = event.target.value;
        vectorSearchResults();
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
        if (isiPhone) {
            window.scrollTo(0, 0);
            alert('Please go to top of the page to check status and listen to the audio');
            callTTSAPI(articles, process.env.REACT_APP_TTS_API_URL);
            return;
        }
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
                const genaiCollection = collection(db, 'genai', user.uid, 'notes');
                let nextQuery;
                nextQuery = query(genaiCollection, orderBy('modifiedDateTime', 'desc'), startAfter(lastVisible), limit(dataLimit));
                const genaiSnapshot = await getDocs(nextQuery);
                const genaiList = genaiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setGenaiData(prevData => [...prevData, ...genaiList]);
                setLastVisible(genaiSnapshot.docs[genaiSnapshot.docs.length - 1]); // Update last visible document
            }
        } catch (error) {
            console.error("Error fetching more data: ", error);
        }
    };

    // Sign Out
    const handleSignOut = () => {
        signOut(auth).catch((error) => {
            console.error('Error signing out:', error);
            alert('Error signing out: ' + error.message);
        });
    };

    // Handler for Generate Button Click
    // **Handler for Generate Button Click**
    const handleSave = async () => {
        if (!fileName.trim() || !promptInput.trim()) {
            alert('Please enter a filename and content.');
            return;
        }
        setIsGenerating(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                console.error("No user is signed in");
                return;
            }

            if (docId.length > 2) {
                const docRef = doc(db, 'genai', user.uid, 'notes', docId);
                await updateDoc(docRef, {
                    fileName: fileName,
                    promptInput: promptInput,
                    modifiedDateTime: new Date(),
                    size: promptInput.length
                });
                embedPrompt(docId);
                console.log('Document updated with ID: ', docId);
                setFileName('');
                setPromptInput('');
                return;
            }
            else {
                const genaiCollection = collection(db, 'genai', user.uid, 'notes');
                const newDocRef = await addDoc(genaiCollection, {
                    fileName: fileName,
                    promptInput: promptInput,
                    createdDateTime: new Date(),
                    modifiedDateTime: new Date(),
                    size: promptInput.length
                });
                console.log('Document written with ID: ', newDocRef.id);
                setDocId(newDocRef.id);
                embedPrompt(newDocRef.id);
                setFileName('');
                setPromptInput('');
            }
        } catch (error) {
            console.error("Error adding document: ", error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Function to call the TTS API
    const callTTSAPI = async (message, apiUrl) => {
        console.log('Calling TTS API with message:', message, ' voiceName:', voiceName);
        console.log('API URL:', apiUrl);
        setIsGeneratingTTS(true); // Set generating state to true

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message, uid: uid, source: 'ai', voice_name: voiceName })
            });

            if (!response.ok) {
                throw new Error([`Network response was not ok: ${response.statusText}`]);
            }
        } catch (error) {
            console.error('Error calling TTS API:', error);
            alert([`Error: ${error.message}`]);
        } finally {
            setIsGeneratingTTS(false); // Reset generating state
            // Optionally, refresh data
            fetchData(uid);
        }
    };


    const handleModelChange = (modelValue) => {
        searchModel = modelValue;
        bigQueryResults();
    }

    const vectorSearchResults = async () => {
        setIsLoading(true);
        console.log("Fetching data for Vector search query:", searchQuery);
        console.log("URL:", process.env.REACT_APP_GENAI_API_VECTOR_URL);
        fetch(process.env.REACT_APP_GENAI_API_VECTOR_URL, {
            method: "POST",
            body: JSON.stringify({
                uid: uid,
                q: searchQuery,
                limit: dataLimit,
            })
        })
            .then((res) => res.json())
            .then(async (data) => {
                const docIds = data.document_ids;
                const genaiCollection = collection(db, 'genai', uid, 'MyGenAI');
                const docsQuery = query(genaiCollection, where('__name__', 'in', docIds));
                const docsSnapshot = await getDocs(docsQuery);
                const genaiList = docsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setGenaiData(genaiList);
                setIsLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching data:", error);
                setIsLoading(false);
            });
    }

    const bigQueryResults = () => {
        setIsLoading(true);
        console.log("Fetching data for search query:", searchQuery);
        console.log("search model:", searchModel);
        console.log("limit:", dataLimit);
        console.log("URL:", process.env.REACT_APP_GENAI_API_BIGQUERY_URL);
        fetch(process.env.REACT_APP_GENAI_API_BIGQUERY_URL, {
            method: "POST",
            body: JSON.stringify({
                uid: uid,
                limit: dataLimit,
                q: searchQuery,
                model: searchModel
            })
        })
            .then((res) => res.json())
            .then((data) => {
                setGenaiData(data);
                setIsLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching data:", error);
                setIsLoading(false);
            });
    }
    if (showMainApp) {
        return (
            <App user={user} />
        );
    }

    return (
        <div>
            <div>
                <div>
                    <input
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        type="text"
                        placeholder="Enter filename"
                        style={{ width: '30%', padding: '10px', marginBottom: '10px', border: '2px', fontSize: '16px' }}
                    />
                    <MDEditor
                        value={promptInput}
                        onChange={(value) => setPromptInput(value)}
                        placeholder="Enter your prompt here..."
                        style={{ width: '99%', padding: '2px', height: '140px', fontSize: '16px' }}
                    />

                </div>

                <div style={{ marginBottom: '20px' }}>
                    <button
                        onClick={handleSave}
                        className="signonpagebutton"
                        style={{ marginLeft: '20px', padding: '15px 20px', fontSize: '16px' }}
                    >
                        {isGenerating ? (
                            <FaSpinner className="spinning" />
                        ) : (
                            'Save'
                        )}
                    </button>
                    &nbsp; &nbsp;
                    {!GenAIParameter ? (
                        <button className='signoutbutton' onClick={() => setShowMainApp(!showMainApp)}>
                            <FaArrowLeft />
                        </button>
                    ) : (
                        <button className='signoutbutton' onClick={handleSignOut}><FaSignOutAlt /> </button>
                    )}
                </div>
                <label>
                    Limit:
                    <input
                        type="number"
                        onBlur={(event) => handleLimitChange(event)}
                        onKeyDown={(event) => (event.key === "Enter" || event.key === "Tab") && handleLimitChange(event)}
                        defaultValue={dataLimit}
                        style={{ width: "50px", margin: "0 10px" }}
                        min={1}
                    />
                </label>
                <input
                    type="text"
                    onKeyDown={(event) => (event.key === "Enter" || event.key === "Tab") && handleVectorSearchChange(event)}
                    placeholder="Semantic or Vector Search"
                    style={{ width: '30%', padding: '10px', border: '2px', fontSize: '16px' }}
                />
                <input
                    type="text"
                    onKeyDown={(event) => (event.key === "Enter" || event.key === "Tab") && handleSearchChange(event)}
                    placeholder="Keyword Search"
                    style={{ width: '30%', padding: '10px', marginLeft: '5px', border: '2px', fontSize: '16px' }}
                />


                {/* **Existing Data Display** */}
                <div>
                    {isLoading && <p> Loading Data...</p>}
                    {!isLoading && <div>
                        {genaiData.map((item) => (
                            <div key={item.createdDateTime}>
                                <div style={{ border: "1px solid black", backgroundColor: "#edf5f1" }}>
                                    <div >
                                        <button style={{ color: "blue", fontWeight: "bold", fontSize: '16px' }} onClick={() => {
                                            setFileName(item.fileName);
                                            setPromptInput(item.promptInput);
                                            setDocId(item.id);
                                            console.log('Document ID:', item.id);
                                        }}>
                                            <FaMarkdown />
                                        </button>
                                        <span style={{ color: "green", fontWeight: "bold", fontSize: '16px' }}> {item.showRawAnswer ? item.fileName : item.fileName} </span>&nbsp;&nbsp;&nbsp;&nbsp;
                                        <span style={{ color: "black", fontSize: '12px' }}>
                                            size: {item.size} &nbsp;&nbsp;&nbsp;&nbsp;
                                            created:  </span>
                                        <span style={{ color: "grey", fontSize: "16px" }}>{new Date(item.createdDateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span> &nbsp;&nbsp;&nbsp;&nbsp;
                                        <span style={{ color: "black", fontSize: '12px' }}>
                                            modified: </span>
                                        <span style={{ color: "blue", fontSize: "16px" }}>{new Date(item.modifiedDateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span> &nbsp;&nbsp;
                                        <button className="signgooglepagebutton" onClick={() => synthesizeSpeech(item.promptInput, item.language || "English")}><FaHeadphones /></button>&nbsp;&nbsp;
                                    </div>
                                </div>
                                <div style={{ border: "1px dotted black", padding: "2px" }}>
                                    <h4 style={{ color: "brown" }}>

                                    </h4>
                                    <div style={{ fontSize: '16px' }}>
                                        {item.promptInput && renderQuestion(item.promptInput)}
                                    </div>
                                </div>

                                <br />
                                <br />
                            </div>
                        ))}
                        <button className="fetchButton" onClick={fetchMoreData} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px' }}>
                            Show more information
                        </button>
                    </div>}
                </div>
            </div>
        </div >
    );
};

export default GenAIApp;
