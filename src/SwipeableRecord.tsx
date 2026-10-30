import {FeedbackPressable as Pressable} from "./FeedbackPressable";
import React, {useEffect, useRef, useState} from "react";
import {ActivityIndicator, Animated, Image, PanResponder, StyleSheet, Text, View} from "react-native";
import {DELETE_ACTION_WIDTH, createSwipeGesture} from "./swipe";

type Props = {
  children: React.ReactNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onGestureActive: (active: boolean) => void;
};

export function SwipeableRecord({children, open, onOpen, onClose, onDelete, onGestureActive}: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  // PanResponder lives for the row's lifetime; callbacks and state stay current.
  const current = useRef({open, onOpen, onClose, onDelete, onGestureActive});
  current.current = {open, onOpen, onClose, onDelete, onGestureActive};
  const settle = (reveal: boolean) => Animated.spring(x, {
    toValue: reveal ? -DELETE_ACTION_WIDTH : 0,
    useNativeDriver: true,
    overshootClamping: true,
    speed: 24,
    bounciness: 0,
  }).start();
  const gesture = useRef(createSwipeGesture({
    getPosition:()=>position.current,
    stopAnimation:()=>x.stopAnimation(),
    move:(value:number)=>{position.current=value;x.setValue(value);},
    open:()=>current.current.onOpen(),close:()=>current.current.onClose(),
    active:(active:boolean)=>current.current.onGestureActive(active),settle,
  })).current;
  const responder = useRef(PanResponder.create(gesture)).current;
  useEffect(() => {if(!gesture.isDragging())settle(open);},[open]);
  useEffect(()=>()=>{if(gesture.isDragging())current.current.onGestureActive(false);},[]);
  useEffect(() => {
    const listener = x.addListener(({value}) => {position.current = value;});
    return () => {x.removeListener(listener); x.stopAnimation();};
  }, [x]);

  return <View style={styles.shell}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="删除这条记录"
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "yes" : "no-hide-descendants"}
      pointerEvents={open ? "auto" : "none"}
      style={styles.deleteAction}
      onPress={() => {onClose(); onDelete();}}
    ><Text style={styles.deleteText}>删除</Text></Pressable>
    <Animated.View {...responder.panHandlers} style={[styles.card, {transform: [{translateX: x}]}]}>
      {children}
    </Animated.View>
  </View>;
}

export function RecordThumbnail({uri, token, onPress}: {uri: string | null; token: string; onPress: () => void}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {setFailed(false); setLoading(true);}, [uri, token]);
  if (!uri) return <View style={styles.thumbnail}><Text style={styles.placeholder}>暂无照片</Text></View>;
  return <Pressable style={styles.thumbnail} accessibilityRole="button" accessibilityLabel="查看打卡照片" onPress={onPress}>
    {failed ? <Text style={styles.placeholder}>照片暂不可用</Text> : <Image
      source={{uri, headers: {Authorization: "Bearer " + token}}}
      resizeMode="cover"
      resizeMethod="resize"
      onLoadEnd={() => setLoading(false)}
      onError={() => {setFailed(true); setLoading(false);}}
      style={styles.image}
    />}
    {loading && !failed && <View pointerEvents="none" style={[StyleSheet.absoluteFill, {alignItems:"center",justifyContent:"center"}]}><ActivityIndicator size="small" color="#c6a75e" /></View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  shell: {borderRadius: 14, overflow: "hidden", marginBottom: 12, backgroundColor: "#24334a"},
  card: {flexDirection: "row", alignItems: "center", padding: 15, gap: 14, backgroundColor: "#24334a", minHeight: 108},
  deleteAction: {position: "absolute", top: 0, bottom: 0, right: 0, width: DELETE_ACTION_WIDTH, alignItems: "center", justifyContent: "center", backgroundColor: "#d43b3b"},
  deleteText: {fontSize: 17, fontWeight: "600", color: "#fff"},
  thumbnail: {width: 76, height: 76, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#34445d"},
  image: {width: "100%", height: "100%"},
  placeholder: {fontSize: 12, lineHeight: 18, color: "#bdc5d2", textAlign: "center", paddingHorizontal: 6},
});
