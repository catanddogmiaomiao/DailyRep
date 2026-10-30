import React from 'react';
import {Pressable as NativePressable, PressableProps} from 'react-native';
import {playInteraction, InteractionFeedback} from './nativeReminders';

// Fire on a completed press, never on press-in: scrolling and cancelled touches stay quiet.
export function FeedbackPressable({feedback='tap',onPress,...props}:PressableProps & {feedback?:InteractionFeedback|false}) {
  return <NativePressable {...props} onPress={onPress ? event=>{
    if(feedback)void playInteraction(feedback);
    onPress(event);
  }:undefined}/>;
}
