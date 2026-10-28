import React from "react";
import {Pressable, StyleSheet, Text, TextInput, View} from "react-native";
import {Ionicons} from "@expo/vector-icons";

export function SetEditor({values, onChange, disabled = false}: {
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  return <View style={{gap: 10}}>
    {values.map((value,index) => <View key={index} style={styles.row}>
      <Text style={styles.text}>第 {index+1} 组</Text>
      <TextInput accessibilityLabel={`第${index+1}组个数`} keyboardType="number-pad" value={value} editable={!disabled}
        onChangeText={text => onChange(values.map((v,i) => i === index ? text : v))}
        placeholder="个数" placeholderTextColor="#8b8b8b" style={styles.input} />
      <Text style={styles.text}>个</Text>
      {values.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={`移除第${index+1}组`} disabled={disabled}
        style={styles.remove} onPress={() => onChange(values.filter((_,i) => i !== index))}>
        <Ionicons name="close" size={20} color="#e8dcc8" />
      </Pressable>}
    </View>)}
    {values.length < 100 && <Pressable accessibilityRole="button" disabled={disabled} style={styles.add} onPress={() => onChange([...values,""])}>
      <Ionicons name="add" size={20} color="#c6a75e" /><Text style={styles.text}>添加一组</Text>
    </Pressable>}
    <Text style={styles.text}>{values.length} 组 · 合计 {values.reduce((sum,v) => sum+(Number(v)||0),0)} 个</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: {flexDirection:"row", gap:10, alignItems:"center"},
  text: {color:"#e8dcc8",fontSize:15},
  input: {flex:1,minWidth:60,minHeight:48,backgroundColor:"#e8dcc8",borderRadius:10,paddingHorizontal:12,color:"#1f2a44",fontSize:20},
  remove: {width:48,height:48,alignItems:"center",justifyContent:"center"},
  add: {minHeight:48,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#c6a75e66",borderRadius:10},
});
