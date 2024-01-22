
import OAI from './OAI.json' assert { type: 'json' };
import DID_API from './API.json' assert { type: 'json' };


const OPENAI_API_KEY = OAI.OPENAI_API_KEY
const script = "In this video join us as Elliott Lamar Arnold turns me into a virtual influencer. I can talk about history, science, movies or business. I'm excited to see what the year 2024 has in store for me."

let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;

let statsIntervalId;
let videoIsPlaying;
let lastBytesReceived;

let avatarImageUrl

const maxRetryCount = 3;
const maxDelaySec = 4;
const promptButton = document.getElementById("prompt-button")
const textarea = document.getElementById('promptInput');
const avatarImage = document.getElementById('image-display');
const connectButton = document.getElementById('connect-button');

const talkStreamButton = document.getElementById('start-button');


const stopStreamButton = document.getElementById('stop-button');

const imageToggle =  document.getElementById('image_toggle');

const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');



  function onIceConnectionStateChange() {
    // iceStatusLabel.innerText = peerConnection.iceConnectionState;
    // iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
    if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
      stopAllStreams();
      closePC();
    }
  }
  function onConnectionStateChange() {
    // not supported in firefox
    // peerStatusLabel.innerText = peerConnection.connectionState;
    // peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
    return
  }
  function onSignalingStateChange() {
    // signalingStatusLabel.innerText = peerConnection.signalingState;
    // signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
    return
  }
  






promptButton.addEventListener("click", async (e) => {
    e.preventDefault()
    console.log("clicked")
    let promptValue = ''; // Variable to store the textarea value
    promptValue = textarea.value;
    console.log(promptValue)

    avatarImageUrl = await generateImageUrl(promptValue)
    console.log(avatarImageUrl)
    avatarImage.src = avatarImageUrl


})



connectButton.addEventListener("click", async () => {

    console.log("Avatar Image URL ", avatarImageUrl)
    imageToggle.classList.add("invisible")
    talkVideo.classList.remove("invisible")

    if (peerConnection && peerConnection.connectionState === 'connected') {
        return;
      }

      stopAllStreams();
      closePC();

      const sessionResponse = await fetchWithRetries(`${DID_API.url}/talks/streams`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url:  avatarImageUrl,
        }),
      });

      const { id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId } = await sessionResponse.json();
      streamId = newStreamId;
      sessionId = newSessionId;
    
      try {
        sessionClientAnswer = await createPeerConnection(offer, iceServers);
      } catch (e) {
        console.log('error during streaming setup', e);
        stopAllStreams();
        closePC();
        return;
      }
    
      const sdpResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}/sdp`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer: sessionClientAnswer,
          session_id: sessionId,
        }),
      });
    
      
    
})



talkStreamButton.onclick = async () => {
    // connectionState not supported in firefox
    if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
      const talkResponse = await fetchWithRetries(`${DID_API.url}/talks/streams/${streamId}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: {
            "input": script ,
              type: "text",
              subtitles: "false",
              "provider": {
                  "type": "microsoft",
                  "voice_id": "en-US-EricNeural"
              },
              "ssml": "false"
            // audio_url: 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/webrtc.mp3',
          },
          // driver_url: 'bank://lively/',
          config: {
            stitch: true,
            fluent: "false",
              pad_audio: "0.0"
          },
          session_id: sessionId,
        }),
      });
    }
  };
  





stopStreamButton.onclick = async () => {
    await fetch(`${DID_API.url}/talks/streams/${streamId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId }),
    });
  
    stopAllStreams();
    closePC();
  };
  


async function createTalk(stream_id, session_id, dialogue) {
    const url = `https://api.d-id.com/talks/streams/${stream_id}`;
    const payload = {
        "script": {
            "input": dialogue,
            "type": "text",
            "subtitles": "false",
            "provider": {
                "type": "microsoft",
                "voice_id": "en-US-JennyNeural"
            },
            "ssml": "false"
        },
        "config": {
            "fluent": "false",
            "pad_audio": "0.0"
        },
        "session_id": session_id
    };
    const headers = {
        "Content-Type": "application/json",
        // "Accept": "application/json",
        "Authorization": `Basic ${DID_API.key}`
    };
  
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });
  
    const data = await response.json();
    console.log(data);
    return data;
  }


const promptQuestionGetResponse = async (question) => {
    const url = 'https://api.openai.com/v1/chat/completions'
      const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    };
    const body = {
      model: "gpt-3.5-turbo",
      messages: [{"role": "user", "content": question}],
      temperature: 0.7
    };
  
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
  
    const data = await response.json();
  
  
    console.log(data.choices[0].message.content)
  
    createTalk(streamId,sessionId, data.choices[0].message.content)
  
    return data.choices[0].message.content;
  } 
  
  async function generateImageUrl(prompt) {
    const url = 'https://api.openai.com/v1/images/generations';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
    };
    const data = {
        'model': 'dall-e-3',
        'prompt': prompt,
        'n': 1,
        'size': '1024x1024',
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const responseData = await response.json();
        return responseData.data[0].url;
    } catch (error) {
        throw error;
    }
}


async function fetchWithRetries(url, options, retries = 1) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries <= maxRetryCount) {
        const delay = Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) * 1000;
  
        await new Promise((resolve) => setTimeout(resolve, delay));
  
        console.log(`Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`);
        return fetchWithRetries(url, options, retries + 1);
      } else {
        throw new Error(`Max retries exceeded. error: ${err}`);
      }
    }
  }


 

  
  

function onIceGatheringStateChange() {
    // iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
    // iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
    return
  }
  function onIceCandidate(event) {
    console.log('onIceCandidate', event);
    if (event.candidate) {
      const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
  
      fetch(`${DID_API.url}/talks/streams/${streamId}/ice`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
          session_id: sessionId,
        }),
      });
    }
  }
 

 
  function onVideoStatusChange(videoIsPlaying, stream) {
    let status;
    if (videoIsPlaying) {
      status = 'streaming';
      const remoteStream = stream;
      setVideoElement(remoteStream);
    } else {
      status = 'empty';
      playIdleVideo();
    }
    // streamingStatusLabel.innerText = status;
    // streamingStatusLabel.className = 'streamingState-' + status;
  
  
    // streamingIdLabel.innerText = streamId
    // streamingIdLabel.className = 'streamingState-' + status;
  
  
    // sessionIdLabel.innerHTML = sessionId
    // sessionIdLabel.className = 'streamingState-' + status;
  
  }
  

function onTrack(event) {
    /**
     * The following code is designed to provide information about wether currently there is data
     * that's being streamed - It does so by periodically looking for changes in total stream data size
     *
     * This information in our case is used in order to show idle video while no talk is streaming.
     * To create this idle video use the POST https://api.d-id.com/talks endpoint with a silent audio file or a text script with only ssml breaks 
     * https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html#break-tag
     * for seamless results use `config.fluent: true` and provide the same configuration as the streaming video
     */
  
    if (!event.track) return;
  
    statsIntervalId = setInterval(async () => {
      const stats = await peerConnection.getStats(event.track);
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          const videoStatusChanged = videoIsPlaying !== report.bytesReceived > lastBytesReceived;
  
          if (videoStatusChanged) {
            videoIsPlaying = report.bytesReceived > lastBytesReceived;
            onVideoStatusChange(videoIsPlaying, event.streams[0]);
          }
          lastBytesReceived = report.bytesReceived;
        }
      });
    }, 500);
  }
  
  async function createPeerConnection(offer, iceServers) {
    if (!peerConnection) {
      peerConnection = new RTCPeerConnection({ iceServers });
      peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
      peerConnection.addEventListener('icecandidate', onIceCandidate, true);
      peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
      peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
      peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
      peerConnection.addEventListener('track', onTrack, true);
    }
  
    await peerConnection.setRemoteDescription(offer);
    console.log('set remote sdp OK');
  
    const sessionClientAnswer = await peerConnection.createAnswer();
    console.log('create local sdp OK');
  
    await peerConnection.setLocalDescription(sessionClientAnswer);
    console.log('set local sdp OK');
  
    return sessionClientAnswer;
  }
  
  function setVideoElement(stream) {
    if (!stream) return;
    talkVideo.srcObject = stream;
    talkVideo.loop = false;
  
    // safari hotfix
    if (talkVideo.paused) {
      talkVideo
        .play()
        .then((_) => {})
        .catch((e) => {});
    }
  }
  
  function playIdleVideo() {
    talkVideo.srcObject = undefined;
    // talkVideo.src = 'or_idle.mp4';
    talkVideo.loop = true;
  }
  
  function stopAllStreams() {
    if (talkVideo.srcObject) {
      console.log('stopping video streams');
      talkVideo.srcObject.getTracks().forEach((track) => track.stop());
      talkVideo.srcObject = null;
    }
  }
  
  function closePC(pc = peerConnection) {
    if (!pc) return;
    console.log('stopping peer connection');
    pc.close();
    pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    pc.removeEventListener('icecandidate', onIceCandidate, true);
    pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
    pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
    pc.removeEventListener('track', onTrack, true);
    clearInterval(statsIntervalId);
    // iceGatheringStatusLabel.innerText = '';
    // signalingStatusLabel.innerText = '';
    // iceStatusLabel.innerText = '';
    // peerStatusLabel.innerText = '';
    console.log('stopped peer connection');
    if (pc === peerConnection) {
      peerConnection = null;
    }
  }
  