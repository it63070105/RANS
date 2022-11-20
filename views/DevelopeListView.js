import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Modal, Pressable, TextInput} from "react-native";
import { useEffect, useState, useRef } from 'react';
import db from "../database/firebaseDB";
import { AntDesign } from "@expo/vector-icons";
import { ScrollView } from "react-native";
import { collection, addDoc, getDocs, onSnapshot, where, query, deleteDoc } from "firebase/firestore";
import axios from "axios";
import { encrypt, decrypt } from "../components/Encryption";

export default function DevelopeListView({route}){

    let [devs, setDevs] = useState([])
    let [modalAddDevVisible, setModalAddDevVisible] =useState(false)
    let [inputName, setInputName] = useState('')
    let [inputId, setInputId] = useState('')
    let [validateDetailFail, setValidateDetailFail] = useState(false)

    function getDev(querySnapshot) {

        let dataFromFirebase = []
        querySnapshot.forEach((res) => {
          dataFromFirebase.push({'name' : res.data().name, 'id' : res.data().id, 'key': res.data().key});
        })

        formatDevs(dataFromFirebase)
    }

    function formatDevs(d){
        function sortName(a, b){
            if (a.name > b.name){
                return 1;
            }
            else if(b.name > a.name){
                return -1;
            }
            else{
                return 0;
            }
        }

        d.sort(sortName)

        setDevs(d)
    }

    function generateDevList(value, index){
        return (<View style={styles.listBox} key={'dev'+index}>
                    <Text style={{width: '10%', textAlign: 'center'}}>{index + 1}</Text>
                    <View style={{width: '1%', borderRightColor: 'black', borderRightWidth: 1, height: '100%'}}></View>
                    <Text style={{width: '69%', paddingLeft: '5%'}}>{value.name} {value.key==route.params.params.key?'(you)':''} {'\nID : ' + value.key}</Text>
                    <View style={{width: '20%', paddingRight: '5%'}}>
                        <TouchableOpacity style={[styles.deleteButton, {opacity:value.key==route.params.params.key?0.3:1}]} 
                            onPress={() => { deleteDev(value, index) }} 
                            disabled={value.key==route.params.params.key}
                            >
                            <AntDesign name="deleteuser" size={24} color="black" />
                        </TouchableOpacity>
                    </View>
                </View>)
    }

    function addDev(){
        setModalAddDevVisible(true)
    }

    async function addDevToDb(name, id){
        if (name == '' || id == ''){
            setValidateDetailFail(true)
        }
        else{
            try{
                let docRef
                docRef = await addDoc(collection(db, "rans-dev-database"), {
                    id: encrypt(id),
                    key: Math.max(...devs.map(o => o.key)) + 1,
                    name: name 
                });
                setInputId('')
                setInputName('')
                setValidateDetailFail(false)
                setModalAddDevVisible(false)
                // getDev();
            }
            catch(error){
                console.error(error)
            }
        }
    }

    async function deleteDev(select, index){
        let q = query(collection(db, "rans-dev-database"), where("key", "==", select.key))
        let u = await getDocs(q)

        u.docs.forEach((t) => {
            deleteDoc(t.ref)
        })

        console.log('Delete Dev: ' + select.name)
        try{
            getDev();
        }
        catch(error){}
    }

    function ModalAddDev(){
        return (
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalAddDevVisible}
            onRequestClose={() => {
              setModalAddDevVisible(false)
            }}
          >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, {width: '50%', height: '40%', padding: '5%'}]}>
                    <Text>Name</Text>
                    <TextInput placeholder='ชื่อ' style={{borderBottomWidth: 1, borderRadius: 10, width: '100%', marginTop: '5%', borderBottomColor:validateDetailFail?"red":"black" }} defaultValue={inputName} onEndEditing={e=>setInputName(e.nativeEvent.text)} />
                    <Text style={{marginTop: '5%'}}>Device id</Text>
                    <TextInput placeholder='id' style={{borderBottomWidth: 1, borderRadius: 10, width: '100%', marginTop: '5%', borderBottomColor:validateDetailFail?"red":"black" }} defaultValue={inputId} onEndEditing={e=>setInputId(e.nativeEvent.text)} />
                    <View style={{flexDirection: 'row'}}>
                        <Pressable
                        style={[styles.button, styles.buttonSubmit, {margin :'5%'}]}
                        onPress={() => addDevToDb(inputName, inputId)}
                        >
                        <Text style={styles.textStyle}>Submit</Text>
                        </Pressable>
                        <Pressable
                        style={[styles.button, styles.buttonClose, {margin :'5%'}]}
                        onPress={() => {setModalAddDevVisible(false)}}
                        >
                        <Text style={styles.textStyle}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
          </Modal>
        )
    }

    useEffect(() => {
        // checkDevId();
        const unsub = onSnapshot(collection(db, 'rans-dev-database'), getDev, (error) => {
            console.log(error)
          });
    }, [])

    return (
        <View style={styles.container}>
            <Text style={styles.heading1}>Welcome Developer {route.params.params.name}{' (devID : ' + route.params.params.key + ')'}</Text>
            <View style={styles.devList}>
                <Text style={styles.heading2}>Developer List</Text>
                <TouchableOpacity style={styles.addDevButton} onPress={() => { addDev() } }>
                    <Text>Add Developer</Text>
                </TouchableOpacity>
                <ScrollView >
                    {devs.length!=0?devs.map(generateDevList):<ActivityIndicator color={'green'} size={'large'}></ActivityIndicator>}
                </ScrollView>
            </View>
            <ModalAddDev />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
    },
    heading1: {
        fontSize: 30,
        textAlign: 'center',
        marginTop: '1%'
    },
    devList: {
        marginTop: '5%',
        marginBottom: '5%',
        alignItems: 'center',
        height: '100%',
    },
    heading2: {
        fontSize: 25
    },
    listBox: {
        width: '95%',
        alignItems: 'center',
        alignSelf: 'center',
        margin: '0.2%',
        padding: '2%',
        flexDirection: 'row',
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        borderRadius: 50,
        backgroundColor: "#fff",
    },
    deleteButton: {
        width: '100%',
        backgroundColor: '#E97777',
        borderRadius: 20,
        alignItems: 'center',
    },
    addDevButton: {
        width: '35%',
        height: '8%',
        padding: '2%',
        backgroundColor: '#82CD47',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        marginTop: '1%',
        marginBottom: '2%',
    },
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 22
      },
      modalView: {
        margin: 20,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 35,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5
      },
      button: {
        borderRadius: 20,
        padding: 10,
        elevation: 2
      },
      buttonClose: {
        backgroundColor: "#FF847C",
      },
      buttonSubmit: {
        backgroundColor: "#ABE6CE",
      },
      modalText: {
        marginBottom: 15,
        textAlign: "center"
      },
});