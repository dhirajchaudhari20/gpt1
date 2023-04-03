import React, { useEffect } from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components/macro';
import { ChatBubbles } from './components/ChatBubbles';
import { Input } from './components/Input';
import { sendMessage } from '../../api/openai';
import { useDispatch, useSelector } from 'react-redux';
import {
  getCharacter,
  getCustomPrompt,
  getMessages,
  getModel,
  getMood,
  getOpenAiApiKey,
} from './slice/selectors';
import { characterOptions } from 'app/api/characters';
import { useMediaQuery } from 'react-responsive';
import { useChatOptionsSlice } from './slice';

const defaultMessages = [
  { role: 'assistant', content: 'Hello there! Start by typing a message!' },
];

/** The request has been sent but no data returned yet. */
let isInitialLoading = false;

/** The user has requested to stop the streaming response. */
let stopRequested = false;

export function Textbox() {
  const messages = useSelector(getMessages);
  const apiKey = useSelector(getOpenAiApiKey);
  const characterSelected = useSelector(getCharacter);
  const moodSelected = useSelector(getMood);
  const modelSelected = useSelector(getModel);
  const customPrompt = useSelector(getCustomPrompt);
  const { actions } = useChatOptionsSlice();
  
  const getText = () => {
    return (isLoading || isRefetching) ? "Stop" : "Submit";
  };
  
  const dispatch = useDispatch();
  const isTabletOrMobile = useMediaQuery({ query: '(max-width: 1024px)' });
  

  const { isLoading, isRefetching, refetch } = useQuery(
    'chat',
    async () => {
      isInitialLoading = true;
      const dataLines = sendMessage(
        apiKey,
        messages,
        moodSelected,
        characterSelected,
        modelSelected,
        customPrompt,
      )
      const next = await dataLines.next();
      isInitialLoading = false;
      updateLastMessage(next.value);
      dispatch(actions.setMessages([...messages, { role: 'assistant', content: '' }]));
      for await (const data of dataLines) {
        if (stopRequested) {
          dataLines.return();
          stopRequested = false;
        }
        updateLastMessage(data);
      }
    },
    {
      enabled: false,
    },
  );
  
  const updateLastMessage = (data: any) => {
    if (data.choices?.length > 0 && data.choices[0].delta.content) {
      dispatch(actions.updateLastMesssage(data.choices[0].delta.content));
    }
  }

  const handleRegenLastMessage = () => {
    const newMessages = messages.slice(0, messages.length - 1);
    dispatch(actions.setMessages(newMessages));
    setTimeout(() => {
      refetch();
    }, 0);
  };

  const addMessage = (message: string) => {
    if (isLoading || isRefetching) {
      stopRequested = true;
      return;
    }
    if (message === '') {
      return;
    }
    dispatch(
      actions.setMessages([...messages, { role: 'user', content: message }]),
    );
    setTimeout(() => {
      refetch();
    }, 0);
  };

  return (
    <Wrapper isMobile={isTabletOrMobile}>
      {characterSelected !== characterOptions[0] && !isTabletOrMobile && (
        <Character>
          You are now speaking to a virtual {characterSelected}. Cool eh?
        </Character>
      )}
      <ChatBubbles isTyping={isInitialLoading} messages={messages} />
      <Input
        text={getText()}
        canRegen={
          messages.length > 1 &&
          messages[messages.length - 1].role === 'assistant' &&
          !isLoading && !isRefetching
        }
        handleRegen={handleRegenLastMessage}
        disabled={isInitialLoading}
        addMessage={addMessage}
      />
    </Wrapper>
  );
}

export const Model = styled.p`
  font-size: 1rem;
  line-height: 1.5;
  color: ${p => p.theme.textSecondary};
  margin: 0;
  position: absolute;
  top: 15px;
`;

const Wrapper = styled.main<any>`
  height: ${props => (props.isMobile ? '100%' : '100%')};
  display: flex;
  width: ${props => (props.isMobile ? '100%' : '65vw')};
  flex-direction: column;
  align-items: center;
  margin-bottom: 0;
  padding-bottom: 0;
  position: relative;
`;

const Character = styled.div`
  color: ${props => props.theme.textSecondary};
  padding: 10px 0;
`;
