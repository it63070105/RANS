import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SearchBar } from 'react-native-elements';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import db from '../database/firebaseDB';
import { collection, query, getDocs, orderBy, updateDoc, doc, getDoc } from "firebase/firestore";
import { Cache } from "react-native-cache";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HeaderButtons, Item } from "react-navigation-header-buttons";
import CustomHeaderButton from '../components/CustomHeaderButton';
import AddRisk from './AddRisk';
import { useFocusEffect } from '@react-navigation/native';
import { encrypt, decrypt } from '../components/Encryption';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export default function ManageRisk({ navigation, route }) {
  const [data, setData] = useState([]); // data เก็บข้อมูลจุดเสี่ยง
  const [search, setSearch] = useState(""); // เก็บ Input จาก SearchBar
  const [pageData, setPageData] = useState([]); // เก็บข้อมูลจุดเสี่ยงและแสดงทีละหน้า
  const [pageCount, setPageCount] = useState(1); // ตัวเลขหน้าแสดงผล
  const [start, setStart] = useState(1); // Index การ filter data
  const [searchStart, setSearchStart] = useState(0); // เก็บข้อมูลจุดเสี่ยงที่ค้นหามาและแสดงทีละหน้า
  const [detailVisible, setDetailVisible] = useState(false); // boolean แสดงผล detail
  const [alreadyLike, setalreadyLike] = useState([]); // เก็บจุดเสี่ยงที่ผู้ใช้กดถูกใจแล้ว
  const [alreadyDisLike, setalreadyDisLike] = useState([]); // เก็บจุดเสี่ยงที่ผู้ใช้กดไม่ถูกใจแล้ว
  const [searching, setSearching] = useState(false); // boolean เก็บว่าผู้ใช้กำลังค้นหาหรือไม่
  const [addPress, setAddPress] = useState(false); // boolean ผู้ใช้กดปุ่ม add บน Header หรือไม่
  const [editPress, setEditPress] = useState(false); // boolean ผู้ใช้กดปุ่ม edit
  const [editText, setEditText] = useState(""); // เก็บข้อความที่ผู้ใช้แก้ไข
  const [detailData, setDetailData] = useState(); // เก็บข้อมูลจุดเสี่ยงเมื่อผู้ใช้กดปุ่ม info
  const [refresh, setRefresh] = useState(true); // boolean refresh หน้า
  const [deviceId, setDeviceId] = useState(""); // Device ID ของผู้ใช้
  const [validateDetailFail, setvalidateDetailFail] = useState(false); // ตรวจสอบการแก้ไขของผู้ใช้

  // function GetPosition ดึงข้อมูลจุดเสี่ยง 100 จุดจาก API
  async function GetPosition(){
    try{
      // จากไฟล์ JSON หาก API ล่ม
      // const customData = require('../assets/RiskArea.json')
      // setData(customData.result.records)

      // จาก API
      await axios.get('https://data.bangkok.go.th/api/3/action/datastore_search?&resource_id=6cc7a43f-52b3-4381-9a8f-2b8a35c3174a')
              .then(response=>{
                setData(response.data.result.records)
              })
              .catch(error=>{
                console.error(error)
              })
    }catch(err){
      console.error(err)
    }
  }

  // function GetData ดึงข้อมูลจาก Firebase Database
  async function GetData() {
    const q = query(collection(db, "rans-database"), orderBy("_id", 'asc'));
    const querySnapshot = await getDocs(q);
    const d = querySnapshot.docs.map((d) => ({ key: d.id, ...d.data() }));
    setData(d)
    const startPage = d.filter((item, index)=>index>=start && index<start+5) // ใช้ในการกำหนดว่าหนึ่งหน้ามีกี่ข้อมูล แยกข้อมูลที่ได้เป็นออกเป็น 5 ข้อมูล / หน้า
    setPageData(startPage) // เก็บที่ filter ออกมา
    if(start==1){
      setStart(start+5)
    }
    setRefresh(false)
  }

  async function onFocusGetData() {
    const q = query(collection(db, "rans-database"), orderBy("_id", 'asc'));
    const querySnapshot = await getDocs(q);
    const d = querySnapshot.docs.map((d) => ({ key: d.id, ...d.data() }));
    setData(d)
    if(searching){
      const searchData = d.filter((item)=>(item.รายละเอียด.indexOf(search)>=0 || item.สำนักงานเขต.indexOf(search)>=0)).sort((a,b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0))
      setPageData(searchData)
    }else{
      if(start==1){
        const startPage = d.filter((item, index)=>index>=start && index<start+5) // ใช้ในการกำหนดว่าหนึ่งหน้ามีกี่ข้อมูล แยกข้อมูลที่ได้เป็นออกเป็น 5 ข้อมูล / หน้า
        setPageData(startPage)
        setStart(start+5)
      }else{
        const startPage = d.filter((item, index)=>index>=start-5 && index<start) // ใช้ในการกำหนดว่าหนึ่งหน้ามีกี่ข้อมูล แยกข้อมูลที่ได้เป็นออกเป็น 5 ข้อมูล / หน้า
        setPageData(startPage)
      }
      setRefresh(false)
    }
  }

  // เก็บ Device ID ของผู้ใช้
  async function GetDeviceID() {
    if (Device.osName == 'iPadOS' || Device.osName == 'iOS'){
      setDeviceId(encrypt(await Application.getIosIdForVendorAsync()))
    }
    else{
      setDeviceId(encrypt(Application.androidId))
    }
  }

  // function GetDataByID ดึงข้อมูลจาก Firebase Database ที่มี id ตาม parameter
  async function GetDataByID(key) {
    const q = doc(db, "rans-database", key); // หาตัวที่ ID ตรงกับ Parameter
    const querySnapshot = await getDoc(q);
    const d = {key: querySnapshot.id, ...querySnapshot.data()};
    if(d){
      if(decrypt(d.owner)==decrypt(deviceId)){
        setDetailData({data: d, userOwn: true}) // เก็บข้อมูลจุดเสี่ยงที่ filter โดยการ where จาก firebase database
      }else{
        setDetailData({data: d, userOwn: false}) // เก็บข้อมูลจุดเสี่ยงที่ filter โดยการ where จาก firebase database
      }
      setEditText(d.รายละเอียด)
    }else{
      alert("ไม่พบข้อมูล (ข้อมูลอาจถูกลบไปแล้ว)")
      setDetailVisible(false)
      setRefresh(true)
      onFocusGetData()
    }
  }

  // รับค่าจาก Cache ที่เก็บในตัวเครื่องของผู้ใช้
  async function GetCache(){
    setalreadyLike(await cache.get('like'))
    setalreadyDisLike(await cache.get('dislike'))
  }

  // ตั้งค่า cache
  const cache = new Cache({
    namespace: "RANS",
    policy: {
        maxEntries: 50000, // if unspecified, it can have unlimited entries
        stdTTL: 0 // the standard ttl as number in seconds, default: 0 (unlimited)
    },
    backend: AsyncStorage
  });

  // เมื่อผู้ใช้กดปุ่มถัดไป
  function NextPage(){
    if(searching){ // ถ้าผู้ใช้ค้นหาอยู่จะแสดงเฉพาะข้อมูลที่มีส่วนเกี่ยวข้องกับที่ค้นหา
      const searchData = data.filter((item)=>(item.รายละเอียด.indexOf(search)>=0 || item.สำนักงานเขต.indexOf(search)>=0)).sort((a,b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0)) // เอาข้อมูลที่เกี่ยวข้องกับที่ผู้ใช้ค้นหาแล้วเรียง id
      const searchPage = searchData.filter((item, index)=>index>=searchStart && index<searchStart+5) // แยกข้อมูลที่ได้เป็นออกเป็น 5 ข้อมูล / หน้า
      if(searchData.length%5!=0){
        if((pageCount+1)>Math.floor(searchData.length/5)+1){ // ป้องกันการกดปุ่มเกิน
          return
        }
      }else{
        if((pageCount+1)>Math.floor(searchData.length/5)){
          return
        }
      }
      setPageData(searchPage)
      setSearchStart(searchStart+5)
    }else{
      if(data.length%5!=0){
        if((pageCount+1)>Math.floor(data.length/5)+1){
          return
        }
      }else{
        if((pageCount+1)>Math.floor(data.length/5)){
          return
        }
      }
      const startPage = data.filter((item, index)=>index>=start && index<start+5) // แยกข้อมูลที่ได้เป็นออกเป็น 5 ข้อมูล / หน้า
      setPageData(startPage)
      setStart(start+5)
    }
    setPageCount(pageCount+1) // เพิ่มเลขหน้า
  }

  // เมื่อผู้ใช้กดปุ่มย้อนกลับ
  function PreviousPage(){
    if((pageCount-1)<1){ // กันการกดย้อนกลับเกิน 1
      return
    }
    if(searching){
      const searchData = data.filter((item)=>(item.รายละเอียด.indexOf(search)>=0 || item.สำนักงานเขต.indexOf(search)>=0)).sort((a,b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0))
      const searchPage = searchData.filter((item, index)=>index>=searchStart-10 && index<searchStart-5) // -10 ให้กลับไปเป็น x ถึง x+5 อีกครั้ง
      setPageData(searchPage)
      setSearchStart(searchStart-5)
    }else{
      const startPage = data.filter((item, index)=>index>=start-10 && index<start-5)
      setPageData(startPage)
      setStart(start-5)
    }
    setPageCount(pageCount-1)
  }

  // Component Function แสดงรายละเอียดของจุดเสี่ยง
  function RisksDetail(){
    if(detailData){
      return (
        <Modal
          animationType="slide"
          transparent={true}
          visible={detailVisible}
          onRequestClose={() => {
            closeDetail();
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View style={styles.modalCloseButton}>
                {detailData.userOwn?
                editPress?
                <TouchableOpacity style={{marginRight: 10}} onPress={()=>{editDetail(detailData.data.key)}}>
                  <MaterialIcons name="check" size={24} color="black" />
                </TouchableOpacity>
                :<TouchableOpacity style={{marginRight: 10}} onPress={()=>setEditPress(true)}>
                  <MaterialIcons name="edit" size={24} color="black" />
                </TouchableOpacity>:null}
                <TouchableOpacity onPress={()=>{closeDetail()}}>
                  <AntDesign name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalTextHeader}>รายละเอียด</Text>
              {detailData.length!=0?
              <View key={detailData.data.key}>
                <View>
                  {editPress?
                  <View style={{flexDirection:'row', marginBottom: 10}}>
                    <Text style={{ fontWeight: 'bold', color:validateDetailFail?"red":"black" }}>รายละเอียด: </Text>
                    <TextInput style={{ borderBottomWidth: 1, marginTop: -5, borderBottomColor:validateDetailFail?"red":"black" }} defaultValue={editText} onEndEditing={e=>setEditText(e.nativeEvent.text)} multiline/>
                    <Text style={{color:"red", fontSize:validateDetailFail?12:0}}>{"\t"}***</Text>
                  </View>
                  :<View style={{marginBottom: 15}}>
                    <Text><Text style={{ fontWeight: 'bold'}}>รายละเอียด</Text>: {editText}</Text>
                  </View>}
                  <Text><Text style={{ fontWeight: 'bold' }}>สำนักงานเขต</Text>: {detailData.data.สำนักงานเขต}</Text>
                </View>
                <View style={styles.modalBottomContainer}>
                  <Text style={[styles.textStyle, {color:alreadyLike==undefined?'black':alreadyLike.filter((likeitem)=>likeitem==detailData.data.key).length>0?'#6BF38B':'black'}]}>
                    <AntDesign name="like1" size={24} color={alreadyLike==undefined?'black':alreadyLike.filter((likeitem)=>likeitem==detailData.data.key).length>0?'#6BF38B':'black'} />
                    {'\t'}{detailData.data.like}
                  </Text>
                  <Text style={[styles.textStyle, {color:alreadyDisLike==undefined?'black':alreadyDisLike.filter((dislikeitem)=>dislikeitem==detailData.data.key).length>0?'#F36C6C':'black'}]}>
                    <AntDesign name="dislike1" size={24} color={alreadyDisLike==undefined?'black':alreadyDisLike.filter((dislikeitem)=>dislikeitem==detailData.data.key).length>0?'#F36C6C':'black'} />
                    {'\t'}{detailData.data.dislike}
                  </Text>
                </View>
              </View>
              :<ActivityIndicator color={'green'} size={'large'}/>}
            </View>
          </View>
        </Modal>
      );
    }
  }

  // แสดง Detail
  function showDetail(){
    setDetailVisible(true)
  }

  // แก้ไข Detail
  async function editDetail(key){
    if(editText==""){
      setvalidateDetailFail(true)
      return
    }else{
      setEditPress(false);
      closeDetail()
      setRefresh(true)
      const q = doc(db, "rans-database", key); // หาตัวที่ ID ตรงกับ Parameter
      const querySnapshot = await getDoc(q);
      if(querySnapshot.exists){
        await updateDoc(doc(db, "rans-database", key), {
          รายละเอียด: editText
        }).then(
          console.log("Detail Updated")
        )
      }else{
        alert("ไม่พบข้อมูล (อาจถูกลบไปแล้ว)")
      }
      setRefresh(false)
      onFocusGetData()
    }
  }

  // ปิด Detail
  function closeDetail(){
    setDetailVisible(false)
    setDetailData([])
    setEditPress(false)
    setvalidateDetailFail(false)
  }

  // อัปเดตข้อมูลการถูกใจใน Firebase Database
  async function updateLike(key) {
    const q = doc(db, "rans-database", key); // หาตัวที่ ID ตรงกับ Parameter
    const querySnapshot = await getDoc(q);
    const likeData = {key: querySnapshot.id, ...querySnapshot.data()};
    let likeCache = await cache.get('like'); // ไม่ใช้ State เพื่อให้อัปเดตง่าย
    let disLikeCache = await cache.get('dislike');
    let likeCheck = []
    let disLikeCheck = []
    if(disLikeCache!=undefined){
      disLikeCheck = disLikeCache.filter((item)=>item==key)
    }
    if(likeCache==undefined){
      likeCache = [] // ถ้าไม่มี Cache หรือ ไม่เคย Like จะ set ใหม่
    }
    likeCheck = likeCache.filter((item)=>item==key)
    if(likeCheck.length==0 && disLikeCheck.length==0){ // เช็คว่าเคย Like หรือ DisLike หรือไม่
      likeCache.push(key)
      await updateDoc(doc(db, "rans-database", key), {
        like: likeData.like+1
      }).then(
        console.log("Like Updated")
      )
    }else if(likeCheck.length>0){ // ถ้า Like อยู่แล้ว จะเอา Like ออก
      likeCache.splice(likeCache.findIndex((item)=>item==key), 1)
      await updateDoc(doc(db, "rans-database", key), {
        like: likeData.like-1
      }).then(
        console.log("Like Updated")
      )
    }else{
      alert('Already Dislike')
    }
    await cache.set('like', likeCache) // Update Cache
    GetCache() // ดึง Cache ใหม่เพื่อให้สีของปุ่มถูกใจเปลี่ยน
  }

  // อัปเดตข้อมูลการไม่ถูกใจใน Firebase Database
  async function updateDislike(key) {
    const q = doc(db, "rans-database", key); // หาตัวที่ ID ตรงกับ Parameter
    const querySnapshot = await getDoc(q);
    const dislikeData = {key: querySnapshot.id, ...querySnapshot.data()};
    let likeCache = await cache.get('like');
    let disLikeCache = await cache.get('dislike');
    let likeCheck = []
    let disLikeCheck = []
    if(likeCache!=undefined){
      likeCheck = likeCache.filter((item)=>item==key)
    }
    if(disLikeCache==undefined){
      disLikeCache = []
    }
    disLikeCheck = disLikeCache.filter((item)=>item==key)
    if(disLikeCheck.length==0 && likeCheck.length==0){
      disLikeCache.push(key)
      await updateDoc(doc(db, "rans-database", key), {
        dislike: dislikeData.dislike+1
      }).then(
        console.log("Dislike Updated")
      )
    }else if(disLikeCheck.length>0){
      disLikeCache.splice(disLikeCache.findIndex((item)=>item==key), 1)
      await updateDoc(doc(db, "rans-database", key), {
        dislike: dislikeData.dislike-1
      }).then(
        console.log("Dislike Updated")
      )
    }else{
      alert('Already Like')
    }
    await cache.set('dislike', disLikeCache)
    GetCache()
  }

  // หากมีการพิมพ์ในช่องค้นหาจะ setstate Search
  const onChangeSearch = query => setSearch(query)

  // เมื่อกดปุ่มล้างการค้นหา
  function clearSearch(){
    const startPage = data.filter((item, index)=>index>=start-5 && index<start) // กลับไปที่หน้าเดิมก่อนการค้นหา
    setPageData(startPage)
    setPageCount(Math.floor((start)/5))
    setSearching(false)
    setSearchStart(0)
  }

  // เมื่อกดปุ่มค้นหา
  function Search(){
    setSearching(true)
    const searchData = data.filter((item)=>(item.รายละเอียด.indexOf(search)>=0 || item.สำนักงานเขต.indexOf(search)>=0)).sort((a,b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0)) // ค้นหาและเรียง id
    if(search == ""){ // เมื่อไม่ได้ใส่อะไรในช่องค้นหาและกดค้นหาจะกลับไปที่เดิมหรืออยู่กับที่
      const startPage = data.filter((item, index)=>index>=start-5 && index<start)
      setSearching(false)
      setPageData(startPage)
      setPageCount(Math.floor((start)/5))
    }else{
      setPageCount(1) // เมื่อกดค้นหาจะแสดงข้อมูลที่ค้นหาได้เท่านั้น ทำให้หน้ากลับไปที่หน้า 1
      if(searchData.length>5){ // ถ้าข้อมูลที่ค้นหามากกว่า 5
        const startPage = searchData.filter((item, index)=>(index>=0 && index<5))
        setPageData(startPage)
        if(searchStart==0){
          setSearchStart(5)
        }
      }else{
        setPageData(searchData)
      }
    }
  }

  function handleAdd(){
    setRefresh(true)
    onFocusGetData()
    setTimeout(()=>{
      setRefresh(false)
    }, 1000)
  }

  // Component Function เมื่อมีการกดปุ่ม + บน Header
  function AddNewRisk(){
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={addPress}
        onRequestClose={() => {
          closeAddModal();
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalViewWithMap}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={()=>{setAddPress(false)}}>
              <AntDesign name="close" size={24} color="black" />
            </TouchableOpacity>
            <AddRisk closeAddModal={closeAddModal} handleAdd={handleAdd}/>
          </View>
        </View>
      </Modal>
    )
  }

  // ปิด Add Modal ที่ผู้ใช้กดปุ่ม + บน Header
  function closeAddModal(){
    setAddPress(false)
  }

  // กำหนด onPress ให้ปุ่ม + บน Header
  useEffect(() => {
    navigation.setOptions({
      headerRight:()=>(
        <HeaderButtons HeaderButtonComponent={CustomHeaderButton}>
          <Item title='add' iconName='add' onPress={()=>{
            setAddPress(true)
          }}/>
        </HeaderButtons>
      )
    });
  }, [navigation, addPress]);

  useEffect(() =>{
    GetData()
    GetDeviceID()
  }, [])

  useFocusEffect(
    useCallback(() => {
      onFocusGetData()
      GetCache() // ทุกครั้งที่ผู้ใช้เปิดหน้านี้จะมีการดึง Cache มาใช้กำหนดสีปุ่ม
      return () => {
      };
    }, [])
  );

  return (
    <ScrollView stickyHeaderIndices={[2]} style={[styles.container, {backgroundColor:detailVisible?'rgba(0,0,0,0.3)':'rgba(255,255,255,1)'}]}>
      <RisksDetail/>
      <AddNewRisk/>
      <View>
        <SearchBar
          placeholder="Search (สถานที่, สำนักงานเขต)"
          containerStyle={styles.searchBar}
          inputContainerStyle={[styles.searchBarInput, {opacity:detailVisible?0.3:1}]}
          onChangeText={onChangeSearch}
          value={search}
          onClear={clearSearch}
          onSubmitEditing={Search}
          keyboardType={"web-search"}
        />
      </View>
      {!refresh?
      pageData.map((item, index)=>(
      <View style={[styles.riskContainer, {opacity:detailVisible?0.3:1}]} key={index}>
        <Text style={styles.riskTitle}>{item.รายละเอียด}</Text>
        <View style={styles.infoButtonContainer}>
          <TouchableOpacity style={styles.infoButton} onPress={()=>{GetDataByID(item.key);showDetail()}}>
            <AntDesign name="infocirlceo" size={24} color="black"/>
          </TouchableOpacity>
        </View>
        <View style={styles.riskButtonContainer}>
          <TouchableOpacity style={styles.riskButton} onPress={()=>{updateLike(item.key)}}>
            <AntDesign name="like1" size={24} color={alreadyLike==undefined?'black':alreadyLike.filter((likeitem)=>likeitem==item.key).length>0?'#6BF38B':'black'}/>
          </TouchableOpacity>
          <TouchableOpacity style={styles.riskButton} onPress={()=>{updateDislike(item.key)}}>
            <AntDesign name="dislike1" size={24} color={alreadyDisLike==undefined?'black':alreadyDisLike.filter((dislikeitem)=>dislikeitem==item.key).length>0?'#F36C6C':'black'}/>
          </TouchableOpacity>
        </View>
      </View>
      ))
      :<ActivityIndicator color={'green'} size={'large'}/>}
      <View style={styles.pageNavContainer}>
        <TouchableOpacity style={[styles.nav, {opacity:detailVisible?0.3:1}]} onPress={PreviousPage}>
          <Text>{'<'}</Text>
        </TouchableOpacity>
        <TextInput style={[styles.nav, {color:'black', opacity:detailVisible?0.3:1}]} value={pageCount.toString()} editable={false} keyboardType="numeric" textAlign='center'/>
        <TouchableOpacity style={[styles.nav, {opacity:detailVisible?0.3:1}]} onPress={NextPage}>
          <Text>{'>'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  map: {
    width: '95%',
    height: '60%',
    margin: 10
  },
  riskContainer: {
    margin: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
    backgroundColor: "#FFF",
  },
  riskTitle: {
    fontWeight: 'bold',
    margin: 10,
    marginBottom: 0,
    width: '85%'
  },
  infoButtonContainer: {
    position: 'absolute',
    top: '3%',
    right: '2%'
  },
  infoButton: {
    margin: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderRadius: 50,
    backgroundColor: "#fff"
  },
  riskButtonContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  riskButton: {
    margin: '3%'
  },
  pageNavContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  nav: {
    margin: '3%',
    marginTop: '1%',
    padding: '5%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderRadius: 5,
    backgroundColor: "#fff"
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalViewWithMap: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalCloseButton: {
    position: 'absolute',
    top: '3%',
    right: '5%',
    flexDirection: 'row',
  },
  modalTextHeader: {
    marginBottom: 15,
    color: 'red',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalBottomContainer:{
    flexDirection: 'row',
    alignSelf: 'center'
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    margin: 2
  },
  textStyle: {
    color: 'black',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 10
  },
  searchBar: {
    backgroundColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent'
  },
  searchBarInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderBottomWidth: 1
  },
  searchButton: {
    position:"absolute",
    right: 0,
    padding: 10,
    borderWidth: 1,
    margin: 10,
    borderRadius: 10,
    backgroundColor: '#fff'
  }
});
