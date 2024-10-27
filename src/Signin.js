import GenAIApp from './GenAIApp';
import App from './App';
import './Signin.css';
import React, { useEffect, useState, useRef } from 'react';
import { FaSignOutAlt, FaBackward, FaArrowLeft, FaAlignJustify } from 'react-icons/fa';
import { auth, db } from './Firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from 'firebase/auth';

function SigninApp() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [uid, setUid] = useState(null);
    const [genaiData, setGenaiData] = useState([]);
    const [currentFileUrl, setCurrentFileUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedFileIndex, setSelectedFileIndex] = useState(null);
    const playerRef = useRef(null);
    const [user, setUser] = useState(null);
    const [showMainApp, setShowMainApp] = useState(false);
    const [showTTSQueueApp, setShowTTSQueueApp] = useState(false);
    const MainApp = process.env.REACT_APP_MAIN_APP;

    // Listen for authentication state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                console.log('Signin component User is signed in:', currentUser.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSignInWithEmail = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            if (!user.emailVerified) {
                await auth.signOut();
                alert('Please verify your email before signing in.');
            }
        } catch (error) {
            alert('Error signing in. ' + error.message);
            console.error('Error signing in:', error);
        }
    };

    const handleSignUpWithEmail = async () => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(auth.currentUser);
            alert('Verification email sent! Please check your inbox.');
            if (!userCredential.user.emailVerified) {
                await auth.signOut();
            }
        } catch (error) {
            alert('Error signing up. ' + error.message);
            console.error('Error signing up:', error);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            alert('Please enter your email to reset your password.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert('Password reset email sent! Please check your inbox.');
        } catch (error) {
            alert('Error sending password reset email. ' + error.message);
            console.error('Error sending password reset email:', error);
        }
    };

    const handleSignInWithGoogle = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch((error) => {
            console.error('Error signing in with Google:', error);
            alert('Error signing in with Google: ' + error.message);
        });
    };

    if (user) {
        if (MainApp === 'GenAIApp') {
            return (
                <GenAIApp user={user} />
            );
        }
        if (MainApp === 'App') {
            return (
                <App user={user} />
            );
        }

    }

    return (
        <div>
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
                <button onClick={handleResetPassword}>
                    Did you forget Password?
                </button>
                <br />
                <br />
                <button className="signgooglepagebutton" onClick={handleSignInWithGoogle}>Sign In with Google</button>
                <br />
                <br />
            </div>
        </div>
    );
}

export default SigninApp;
