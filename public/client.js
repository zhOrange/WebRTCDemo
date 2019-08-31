// getting dom elements

var divSelectRoom = document.getElementById("selectRoom");
var inputRoomNumber = document.getElementById("roomNumber");
var btnGoRoom = document.getElementById("goRoom");

var divConsultingRoom = document.getElementById("consultingRoom");
var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");

//dataChannel elements
//
var dataConstraint = null;
var sendChannel;
var receiveChannel;

var dataChannelSend = document.querySelector('textarea#dataChannelSend');
var fileInput = document.getElementById('fileSend');
var fileChannelReceive = document.querySelector('img#recvImg');
var dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
var sendButton = document.querySelector('button#sendBtn');

var receiveBuffer = [];

sendButton.onclick = sendData;

// variables
var roomNumber;
var localStream;
var remoteStream;
var rtcPeerConnection;
var iceServers = {
    'iceServers': [
        { 'urls': 'stun:stun.services.mozilla.com' },
        { 'urls': 'stun:stun.l.google.com:19302' }
    ]
}
var streamConstraints = { audio: true, video: true };
var isCaller;

// Let's do this
var socket = io();

btnGoRoom.onclick = function () {
	console.log('Clicked');
    if (inputRoomNumber.value === '') {
        alert("Please type a room number")
    } else {
        roomNumber = inputRoomNumber.value;
        socket.emit('create or join', roomNumber);
        divSelectRoom.style = "display: none;";
        divConsultingRoom.style = "display: block;";
    }
};

// message handlers
socket.on('created', function (room) {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localStream = stream;
        localVideo.srcObject = stream;
        isCaller = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('joined', function (room) {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localStream = stream;
        localVideo.srcObject = stream;
        socket.emit('ready', roomNumber);
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('candidate', function (event) {
    var candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate
    });
    rtcPeerConnection.addIceCandidate(candidate);
});

socket.on('ready', function () {
    if (isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        //create dataChannel
        sendChannel = rtcPeerConnection.createDataChannel('sendDataChannel',
        dataConstraint);
        //sendChannel.binaryType = 'arraybuffer';
        rtcPeerConnection.ondatachannel = receiveChannelCallback;

        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.ontrack = onAddStream;
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnection.createOffer()
            .then(sessionDescription => {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                socket.emit('offer', {
                    type: 'offer',
                    sdp: sessionDescription,
                    room: roomNumber
                });
            })
            .catch(error => {
                console.log(error)
            })
    }
});

socket.on('offer', function (event) {
    if (!isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        //receive data Channel
        sendChannel = rtcPeerConnection.createDataChannel('sendDataChannel',
        dataConstraint);
        //sendChannel.binaryType = 'arraybuffer';
        rtcPeerConnection.ondatachannel = receiveChannelCallback;

        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.ontrack = onAddStream;
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
        rtcPeerConnection.createAnswer()
            .then(sessionDescription => {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                socket.emit('answer', {
                    type: 'answer',
                    sdp: sessionDescription,
                    room: roomNumber
                });
            })
            .catch(error => {
                console.log(error)
            })
    }
});

socket.on('answer', function (event) {
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
});

socket.on('full', function(){
	console.log('the room is full');
});

// handler functions
function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate');
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            room: roomNumber
        });
    }
}

function onAddStream(event) {
    remoteVideo.srcObject = event.streams[0];
    remoteStream = event.stream;
}

//dataChannel send Data
function sendData() {
  //var data = dataChannelSend.value;
  //var data = fileChannelSend.value;
  const file = fileInput.files[0];
  console.log('file size: ' + file.size);
  fileReader = new FileReader();
  fileReader.readAsDataURL(file);
  fileReader.onload = function(event){
  	console.log('byteLength:' + event.target.result);
  	//sendChannel.send(event.target.result);
  	sendChannel.send(fileReader.result)
  }
}


function receiveChannelCallback(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.binaryType = 'arraybuffer'
  receiveChannel.onmessage = onReceiveMessageCallback;
}

function onReceiveMessageCallback(event) {
  //console.log(`Received Message ${event.data.json('')}`);
  //dataChannelReceive.value = event.data;
  //receiveBuffer.push(event.data)
  //console.log('receiveBUffer: ' + receiveBuffer.length)
  //const received = new Blob(event.data);
  //receiveBuffer = [];
  fileChannelReceive.src = event.data
}

function trace(text) {
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
  }
}

