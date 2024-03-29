import React, { Component } from "react";
import { Button, Modal, Spinner } from "react-bootstrap";
import "react-html5-camera-photo/build/css/index.css";
import firebase from "firebase";
import Navigation from "../../components/Navigation";
import { FaLock, FaUnlock } from "react-icons/fa";
import CameraModal from "../../components/camera";

const detectfaceIdUrl =
  "https://facerecod.cognitiveservices.azure.com/face/v1.0/detect";
const verifyfaceIdUrl =
  "https://facerecod.cognitiveservices.azure.com/face/v1.0/verify";
const faceIdKey = "87ca84c043b54858863b6502158e5719";

export default class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      image: "",
      isCameraVisible: false,
      isLocked: true,
      faceId: "",
      loading: false,
      uid: ""
    };
    this.onTakePhoto = this.onTakePhoto.bind(this);
    this.getFaceId = this.getFaceId.bind(this);
    // this.saveToFirebase = this.saveToFirebase.bind(this);
    this.changeLockStatus = this.changeLockStatus.bind(this);
  }

  onTakePhoto(dataUri) {
    // Do stuff with the dataUri photo...
    console.log(dataUri);
    this.setState({ isCameraVisible: false, image: dataUri });
    this.uploadImageToFirestore(dataUri);
    // this.getFaceId(dataUri);
  }

  async componentDidMount() {
    setTimeout(async () => {
      if (firebase.apps.length) {
        if (firebase.auth().currentUser != null) {
          const uid = await firebase.auth().currentUser.uid;
          this.setState({ uid });
          firebase
            .firestore()
            .collection("users")
            .doc(uid.toString())
            .onSnapshot(snap => {
              if (snap.exists) {
                const isLocked = snap.data().isLocked;
                this.setState({ isLocked });
              }
            });
        } else {
          this.props.history.push("/login");
        }
      }
    }, 1000);
  }

  uploadImageToFirestore = image => {
    this.setState({ loading: true });
    const task = firebase
      .storage()
      .ref("/image.jpeg")
      .putString(image, "data_url");
    task.on(
      "state_changed",
      snapshot => {
        var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log("Upload is " + progress + "% done");
      },
      error => {
        this.setState({
          loading: false
        });
        console.log(error);
      },
      () => {
        task.snapshot.ref.getDownloadURL().then(downloadURL => {
          console.log("File available at", downloadURL);
          this.getFaceId(downloadURL);
        });
      }
    );
  };

  getBinary(encodedFile) {
    var base64Image = encodedFile.split("data:image/png;base64,")[1];
    var binaryImg = atob(base64Image);
    var length = binaryImg.length;
    var ab = new ArrayBuffer(length);
    var ua = new Uint8Array(ab);
    for (var i = 0; i < length; i++) {
      ua[i] = binaryImg.charCodeAt(i);
    }

    var blob = new Blob([ab], {
      type: "image/jpeg"
    });

    return ab;
  }

  getFaceId(image) {
    // var creds = AWS.Credentials({
    //     accessKeyId: 'AKIA4PJHTHYA3Y47HLCM', secretAccessKey: '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'});
    // AWS.config.update({
    //   region: 'us-east-2',
    //   credentials: {
    //     accessKeyId: 'AKIA4PJHTHYA3Y47HLCM', secretAccessKey: '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'
    //   }
    // })
    // //

    // const rekognition = new AWS.Rekognition();
    // rekognition.compareFaces({
    //   SourceImage: {
    //     Bytes: this.getBinary(image)
    //   },
    //   TargetImage: {
    //     Bytes: this.getBinary(image)
    //   }
    // }, (err, data) => {
    //   if(err) console.log(err);
    //   else console.log(data);
    // })

    const data = { url: image };
    fetch(detectfaceIdUrl, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": faceIdKey
      },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(resjson => {
        console.log(resjson);
        if (resjson.length > 0) {
          const faceId = resjson[0].faceId;
          console.log(faceId);
          this.setState({ faceId });
          // this.saveToFirebase(faceId);
          this.getFaceDataFromFirestore();
        }
      })
      .catch(e => {
        this.setState({
          loading: false
        });
        console.log(e)});
  }

  async getFaceDataFromFirestore() {
    const { uid } = this.state;
    firebase
      .firestore()
      .collection("users/" + uid + "/faces")
      .get()
      .then(snap => {
        if (!snap.empty) {
          var faceIds = [];
          snap.docs.forEach(item => {
            console.log(item.data());
            faceIds.push(item.data().faceId);
          });
          this.checkMatchingFaceId(faceIds);
        }else{
          this.setState({
            loading: false
          });
        }
      })
  }

  checkMatchingFaceId(faces) {
    const { faceId, loading } = this.state;
    let isIdentical = false;
    let index = 0;
    if (faces.length > 0 && faceId) {
      faces.forEach(async item => {

          this.compareFaceIds(item, faceId).then((d)=>{
            isIdentical = true;
            console.log(d);
           this.setState({ loading: false });
           this.changeLockStatus(false);
           index += 1;
           }).catch(e => {
             this.setState({ loading: false });
             if(!isIdentical){
              this.changeLockStatus(true);
              index += 1;
             }
           }).finally(() => {
             if(isIdentical){
               if(index === faces.length){
               alert("Unlocked");
               }
             }else{
               if(index === faces.length){
                 alert("No Match Found");
                 }
             }
           })
         
      });
    }
  }

  async compareFaceIds(faceId1, faceId2) {
    // print("running");
    const data = { faceId1: faceId1, faceId2: faceId2 };
    console.log(data);

    return new Promise((resolve, reject) => {
      fetch(verifyfaceIdUrl, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": faceIdKey
      },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(resjson => {
        console.log(resjson);
        if (resjson) {
          const isIdentical = resjson.isIdentical;
          if(isIdentical){
          this.setState({ loading: false, isLocked: false });
          this.changeLockStatus(false);
          resolve(true);
          }else{
            reject(false);
          }
        } else {
          reject(false);
        }
      }).catch(e => {
        reject(false);
      })
    });
  }

  async changeLockStatus(isLocked) {
    const { uid } = this.state;
    firebase
      .firestore()
      .collection("users")
      .doc(uid.toString())
      .update({
        isLocked
      });
  }

  render() {
    const { isLocked } = this.state;
    return (
      <>
        <Navigation />
        <div
          style={{
            alignItems: "center",
            height: "90vh",
            width: "20vw",
            minWidth: "200px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            margin: "0 auto"
          }}
        >
          <Button
            onClick={() => this.setState({ isCameraVisible: true })}
            variant="primary"
            style={{ width: "100%" }}
          >
            Open Camera
          </Button>
          <div style={{ marginTop: 20 }}>
            {isLocked ? (
              <FaLock color="#007bff" size={50} />
            ) : (
              <FaUnlock color="#007bff" size={50} />
            )}
          </div>
          <div style={{ marginTop: 20 }}>
            <p>Current Status: {isLocked ? "Locked" : "Unlocked"}</p>
          </div>
        </div>
        <CameraModal
          onTake={this.onTakePhoto}
          onHide={() => this.setState({ isCameraVisible: false })}
          isVisible={this.state.isCameraVisible}
        />

        <Modal
          size="sm"
          // aria-labelledby="contained-modal-title-hcenter"
          centered
          show={this.state.loading}
          onHide={() => this.setState({ loading: false })}
        >
          <div
            style={{
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              padding: 12
            }}
          >
            <img
              src={this.state.image}
              style={{ width: 80, height: 80, borderRadius: 40, margin: 12 }}
            />
            <Spinner animation="border" variant="primary" />
          </div>
        </Modal>
      </>
    );
  }
}
