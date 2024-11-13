
import {KNNImageClassifier} from 'deeplearn-knn-image-classifier';
import * as dl from 'deeplearn';

const IMAGE_SIZE = 227;
const TOPK = 10;

const predictionThreshold = 0.98
var words = ["alexa", "hello"]
var endWords = ["hello"]
class LaunchModal {
  constructor(){
    this.modalWindow = document.getElementById('launchModal')

    this.closeBtn = document.getElementById('close-modal')

    this.closeBtn.addEventListener('click', (e) => {
      this.modalWindow.style.display = "none"
    })

    window.addEventListener('click', (e) => {
      if(e.target == this.modalWindow){
        this.modalWindow.style.display = "none"
      }
    })

    this.modalWindow.style.display = "block"
    this.modalWindow.style.zIndex = 500
  }
}


class Main {
  constructor(){
    // Initiate variables
    this.infoTexts = [];
    this.training = -1; // -1 when no class is being trained
    this.videoPlaying = false;

    this.previousPrediction = -1
    this.currentPredictedWords = []

    // variables to restrict prediction rate
    this.now;
    this.then = Date.now()
    this.startTime = this.then;
    this.fps = 5; //framerate - number of prediction per second
    this.fpsInterval = 1000/(this.fps); 
    this.elapsed = 0;

    this.trainingListDiv = document.getElementById("training-list")
    this.exampleListDiv = document.getElementById("example-list")
    
    this.knn = null

    this.textLine = document.getElementById("text")
    
    // Get video element that will contain the webcam image
    this.video = document.getElementById('video');

    this.addWordForm = document.getElementById("add-word")

    this.statusText = document.getElementById("status-text")

    this.video.addEventListener('mousedown', () => {
      // click on video to go back to training buttons
      main.pausePredicting();
      this.trainingListDiv.style.display = "block"
    })

    // add word to training example set
    this.addWordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let word = document.getElementById("new-word").value.trim().toLowerCase();
      let checkbox = document.getElementById("is-terminal-word")

      if(word && !words.includes(word)){
        //console.log(word)
        words.splice(words.length-1,0,word) //insert at penultimate index in array
        this.createButtonList(false)
        this.updateExampleCount()
        //console.log(words)
        

        if(checkbox.checked){
          endWords.push(word)
        }

        document.getElementById("new-word").value = ''
        checkbox.checked = false;

        // console.log(words)
        // console.log(endWords)

      } else {
        alert("Duplicate word or no word entered")
      }

      return
    })

    // show modal window
    let modal = new LaunchModal()

    this.updateExampleCount()

    document.getElementById("status").style.display = "none"

    this.createTrainingBtn()
    
    this.createButtonList(false)
    
    // load text to speech
    this.tts = new TextToSpeech()

  }

  createPredictBtn(){
    var div = document.getElementById("action-btn")
    div.innerHTML = ""
    const predButton = document.createElement('button')

    predButton.innerText = "Start Predicting >>>"
    div.appendChild(predButton);

    predButton.addEventListener('mousedown', () => {
      console.log("start predicting")
      const exampleCount = this.knn.getClassExampleCount()

      // check if training has been done
      if(Math.max(...exampleCount) > 0){

        // if wake word has not been trained
        if(exampleCount[0] == 0){
          alert(
            `You haven't added examples for the wake word ALEXA`
            )
          return
        }

        // if the catchall phrase other hasnt been trained
        if(exampleCount[words.length-1] == 0){
          alert(
            `You haven't added examples for the catchall sign OTHER.\n\nCapture yourself in idle states e.g hands by your side, empty background etc.\n\nThis prevents words from being erroneously detected.`)
          return
        }

        // check if atleast one terminal word has been trained
        if(!this.areTerminalWordsTrained(exampleCount)){
          alert(
            `Add examples for atleast one terminal word.\n\nA terminal word is a word that appears at the end of a query and is necessary to trigger transcribing. e.g What is *the weather*\n\nYour terminal words are: ${endWords}`
            )
          return
        }

        this.trainingListDiv.style.display = "none"
        this.textLine.classList.remove("intro-steps")
        this.textLine.innerText = "Sign your query"
        this.startPredicting()
      } else {
        alert(
          `You haven't added any examples yet.\n\nPress and hold on the "Add Example" button next to each word while performing the sign in front of the webcam.`
          )
      }
    })
  }

  createTrainingBtn(){
    var div = document.getElementById("action-btn")
    div.innerHTML = ""

    const trainButton = document.createElement('button')
    trainButton.innerText = "Training >>>"
    div.appendChild(trainButton);


    trainButton.addEventListener('mousedown', () => {

      // check if user has added atleast one terminal word
      if(words.length > 3 && endWords.length == 1){
        console.log('no terminal word added')
        alert(`You have not added any terminal words.\nCurrently the only query you can make is "Alexa, hello".\n\nA terminal word is a word that will appear in the end of your query.\nIf you intend to ask "What's the weather" & "What's the time" then add "the weather" and "the time" as terminal words. "What's" on the other hand is not a terminal word.`)
        return
      }

      if(words.length == 3 && endWords.length ==1){
        var proceed = confirm("You have not added any words.\n\nThe only query you can currently make is: 'Alexa, hello'")

        if(!proceed) return
      }

      this.startWebcam()

      console.log("ready to train")
      this.createButtonList(true)
      this.addWordForm.innerHTML = ''
      let p = document.createElement('p')
      p.innerText = `Perform the appropriate sign while holding down the ADD EXAMPLE button near each word to capture atleast 30 training examples for each word

      For OTHER, capture yourself in an idle state to act as a catchall sign. e.g hands down by your side`
      this.addWordForm.appendChild(p)
      
      this.loadKNN()

      this.createPredictBtn()

      this.textLine.innerText = "Step 2: Train"

      let subtext = document.createElement('span')
      subtext.innerHTML = "<br/>Time to associate signs with the words" 
      subtext.classList.add('subtext')
      this.textLine.appendChild(subtext)

    })
  }

  areTerminalWordsTrained(exampleCount){

    var totalTerminalWordsTrained = 0

    for(var i=0;i<words.length;i++){
      if(endWords.includes(words[i])){
        if(exampleCount[i] > 0){
          totalTerminalWordsTrained+=1
        }
      }
    }

    return totalTerminalWordsTrained
  }

  startWebcam(){
    // Setup webcam
    navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}, audio: false})
    .then((stream) => {
      this.video.srcObject = stream;
      this.video.width = IMAGE_SIZE;
      this.video.height = IMAGE_SIZE;

      this.video.addEventListener('playing', ()=> this.videoPlaying = true);
      this.video.addEventListener('paused', ()=> this.videoPlaying = false);
    })
  }

  loadKNN(){

    this.knn = new KNNImageClassifier(words.length, TOPK);

    // Load knn model
    this.knn.load()
    .then(() => this.startTraining()); 
  }

  updateExampleCount(){
    var p = document.getElementById('count')
    p.innerText = `Training: ${words.length} words`
  }

  createButtonList(showBtn){
    //showBtn - true: show training btns, false:show only text

    // Clear List
    this.exampleListDiv.innerHTML = ""

    // Create training buttons and info texts    
    for(let i=0;i<words.length; i++){
      this.createButton(i, showBtn)
    }
  }

  createButton(i, showBtn){
    const div = document.createElement('div');
    this.exampleListDiv.appendChild(div);
    div.style.marginBottom = '10px';
    
    // Create Word Text
    const wordText = document.createElement('span')

    if(i==0 && !showBtn){
      wordText.innerText = words[i].toUpperCase()+" (wake word) "
    } else if(i==words.length-1 && !showBtn){
      wordText.innerText = words[i].toUpperCase()+" (catchall sign) "
    } else {
      wordText.innerText = words[i].toUpperCase()+" "
      wordText.style.fontWeight = "bold"
    }
    
    
    div.appendChild(wordText);

    if(showBtn){
      // Create training button
      const button = document.createElement('button')
      button.innerText = "Add Example"//"Train " + words[i].toUpperCase()
      div.appendChild(button);

      // Listen for mouse events when clicking the button
      button.addEventListener('mousedown', () => this.training = i);
      button.addEventListener('mouseup', () => this.training = -1);

      // Create clear button to emove training examples
      const btn = document.createElement('button')
      btn.innerText = "Clear"//`Clear ${words[i].toUpperCase()}`
      div.appendChild(btn);

      btn.addEventListener('mousedown', () => {
        console.log("clear training data for this label")
        this.knn.clearClass(i)
        this.infoTexts[i].innerText = " 0 examples"
      })
      
      // Create info text
      const infoText = document.createElement('span')
      infoText.innerText = " 0 examples";
      div.appendChild(infoText);
      this.infoTexts.push(infoText);
    }
  }
  
  startTraining(){
    if (this.timer) {
      this.stopTraining();
    }
    var promise = this.video.play();

    if(promise !== undefined){
      promise.then(_ => {
        console.log("Autoplay started")
      }).catch(error => {
        console.log("Autoplay prevented")
      })
    }
    this.timer = requestAnimationFrame(this.train.bind(this));
  }
  
  stopTraining(){
    this.video.pause();
    cancelAnimationFrame(this.timer);
  }
  
  train(){
    if(this.videoPlaying){
      // Get image data from video element
      const image = dl.fromPixels(this.video);
      
      // Train class if one of the buttons is held down
      if(this.training != -1){
        // Add current image to classifier
        this.knn.addImage(image, this.training)
      }

      const exampleCount = this.knn.getClassExampleCount()

      if(Math.max(...exampleCount) > 0){
        for(let i=0;i<words.length;i++){
          if(exampleCount[i] > 0){
            this.infoTexts[i].innerText = ` ${exampleCount[i]} examples`
          }
        }
      }
    }
    this.timer = requestAnimationFrame(this.train.bind(this));
  }

  startPredicting(){
    // stop training
    if(this.timer){
      this.stopTraining();
    }

    document.getElementById("status").style.background = "deepskyblue"
    this.setStatusText("Status: Ready!")

    this.video.play();

    this.pred = requestAnimationFrame(this.predict.bind(this))
  }

  pausePredicting(){
    console.log("pause predicting")
    this.setStatusText("Status: Paused Predicting")
    cancelAnimationFrame(this.pred)
  }

  predict(){
    this.now = Date.now()
    this.elapsed = this.now - this.then

    if(this.elapsed > this.fpsInterval){

      this.then = this.now - (this.elapsed % this.fpsInterval)

      if(this.videoPlaying){
        const exampleCount = this.knn.getClassExampleCount();

        const image = dl.fromPixels(this.video);

        if(Math.max(...exampleCount) > 0){
          this.knn.predictClass(image)
          .then((res) => {
            for(let i=0;i<words.length;i++){

              // if matches & is above threshold & isnt same as prev prediction
              // and is not the last class which is a catch all class
              if(res.classIndex == i 
                && res.confidences[i] > predictionThreshold 
                && res.classIndex != this.previousPrediction
                && res.classIndex != words.length-1){

                this.tts.speak(words[i])

                // set previous prediction so it doesnt get called again
                this.previousPrediction = res.classIndex;


              }
            }
          })
          .then(() => image.dispose())
        } else {
          image.dispose()
        }
      }
    }

    this.pred = requestAnimationFrame(this.predict.bind(this))
  }

  setStatusText(status){
    document.getElementById("status").style.display = "block"
    this.statusText.innerText = status
  }

}

class TextToSpeech {
  constructor() {
    this.synth = window.speechSynthesis
    this.voices = []
    this.pitch = 1.0
    this.rate = 0.9

    this.textLine = document.getElementById("text")
    this.ansText = document.getElementById("answerText")
    this.loader = document.getElementById("loader")

    this.selectedVoice = 48

    this.currentPredictedWords = []
    this.waitTimeForQuery = 5000

    this.synth.onvoiceschanged = () => {
      this.populateVoiceList()
    }
  }

  populateVoiceList() {
    if (typeof speechSynthesis === 'undefined') {
      console.log("no synth")
      return
    }
    this.voices = this.synth.getVoices()

    if (this.voices.indexOf(this.selectedVoice) > 0) {
      console.log(`${this.voices[this.selectedVoice].name}:${this.voices[this.selectedVoice].lang}`)
    }
  }

  clearPara(queryDetected) {
    this.textLine.innerText = '';
    this.ansText.innerText = ''
    if (queryDetected) {
      this.loader.style.display = "block"
    } else {
      this.loader.style.display = "none"
      this.ansText.innerText = "No query detected"
      main.previousPrediction = -1
    }
    this.currentPredictedWords = []
  }

  // async getAPIResponse(query) {
  //   this.loader.style.display = "block"
  //   this.ansText.innerText = "Getting response..."

  //   const url = `https://free-chatgpt-api.p.rapidapi.com/chat-completion-one?prompt=${encodeURIComponent(query)}`;

  //   try {
  //     const response = await fetch(url, {
  //       method: 'GET',
  //       headers: {
  //         'X-RapidAPI-Host': 'free-chatgpt-api.p.rapidapi.com',
  //         'X-RapidAPI-Key': '325dc6abaemshc05fd4caeb5b48dp1f5a66jsnee672d1b3e4b'
  //       }
  //     });

  //     console.log('API Response:', response); // Debug log

  //     if (!response.ok) {
  //       throw new Error(`API response failed with status: ${response.status}`);
  //     }

  //     const data = await response.json();
  //     console.log('API Data:', data); // Debug log
      
  //     if (data && data.content) {
  //       this.ansText.innerText = data.content;
  //     } else {
  //       this.ansText.innerText = "Received unexpected response format";
  //     }
      
  //   } catch (error) {
  //     console.error('API Error:', error);
  //     this.ansText.innerText = "Sorry, there was an error getting the response: " + error.message;
  //   } finally {
  //     this.loader.style.display = "none"
  //     // Reset for next query
  //     main.previousPrediction = -1;
  //     main.startPredicting();
  //   }
  // }
  async getAPIResponse(query) {
    this.loader.style.display = "block";
    this.ansText.innerText = "Getting response...";
  
    const url = `https://free-chatgpt-api.p.rapidapi.com/chat-completion-one?prompt=${encodeURIComponent(query)}`;
  
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Host': 'free-chatgpt-api.p.rapidapi.com',
          'X-RapidAPI-Key': '325dc6abaemshc05fd4caeb5b48dp1f5a66jsnee672d1b3e4b'
        }
      });
  
      console.log('API Response:', response); // Debug log
  
      if (!response.ok) {
        throw new Error(`API response failed with status: ${response.status}`);
      }
  
      const data = await response.json();
      console.log('API Data:', data); // Debug log
  
      if (data && data.status === "success" && data.response) {
        // Extract response text if status is 'success'
        this.ansText.innerText = data.response;
      } else {
        this.ansText.innerText = "Received unexpected response format";
      }
      
    } catch (error) {
      console.error('API Error:', error);
      this.ansText.innerText = "Sorry, there was an error getting the response: " + error.message;
    } finally {
      this.loader.style.display = "none";
      // Reset for next query
      main.previousPrediction = -1;
      main.startPredicting();
    }
  }
  
  speak(word) {
    if (word == 'alexa') {
      console.log("clear para")
      this.clearPara(true);

      setTimeout(() => {
        if (this.currentPredictedWords.length == 1) {
          this.clearPara(false)
        }
      }, this.waitTimeForQuery)
    }

    if (word != 'alexa' && this.currentPredictedWords.length == 0) {
      console.log("first word should be alexa")
      return
    }

    if (this.currentPredictedWords.includes(word)) {
      console.log("word already been detected in current phrase")
      return
    }

    this.currentPredictedWords.push(word)
    this.textLine.innerText += ' ' + word;

    // When an end word is detected, send the complete query to RapidAPI
    if (endWords.includes(word)) {
      console.log("End word detected, sending query to API");
      main.pausePredicting();
      
      // Remove 'alexa' from the query before sending
      const queryWords = this.currentPredictedWords.filter(w => w !== 'alexa');
      const completeQuery = "in less than 70 words , " + queryWords.join(' ');
      console.log('Sending query:', completeQuery); // Debug log
      
      this.getAPIResponse(completeQuery);
    } else {
      // Speak the word for feedback as user builds the query
      var utterThis = new SpeechSynthesisUtterance(word)
      utterThis.voice = this.voices[this.selectedVoice]
      utterThis.pitch = this.pitch
      utterThis.rate = this.rate
      this.synth.speak(utterThis)
    }
  }
}

var main = null;

window.addEventListener('load', () => {

  var ua = navigator.userAgent.toLowerCase()

  if(!(ua.indexOf("chrome") != -1 || ua.indexOf("firefox")!= -1)){
    alert("Please visit in the latest Chrome or Firefox")
    return
  } 


  main = new Main()

});

