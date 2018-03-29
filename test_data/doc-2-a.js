import React from 'react';
import call from 'react-native-phone-call';
import { CallSecurityToolbarButton } from 'src/components/call-security-toolbar-button';
import { EventBus } from 'src/services/event-bus';
import { GoogleAnalytics } from 'src/services/google-analytics';
import { HomeNavigator } from 'src/navigators';
import { Images } from 'src/styles/images';
import { Screen } from 'src/screens/screen';
import { ToolbarButton } from 'src/components/toolbar-button';
import { UrbanAirship } from 'urbanairship-react-native';
import { Utils } from 'src/utils';


class HomeScreen extends Screen {

  constructor(props) {
    super(props);
  }
  
  componentWillMount() {
    UrbanAirship.addListener('notificationResponse', this.pushNotification);
    
    let notification = this.getPendingNotification();
    if (notification) {
      this.pushNotification(notification);
    }
  }
  
  componentWillUnmount() {
    UrbanAirship.removeListener('notificationResponse', this.pushNotification);
  }
  
  pushNotification = (notification) => {
    console.log('HomeScreen.pushNotification', notification);
    try {
      this.props.navigation.navigate('MessageScreen', {
        messageId: notification.notification.extras.messageId
      });
      // Refresh the messages on the messages screen after
      // waiting two seconds
      setTimeout(() => {
        EventBus.publish('newMessage');
      }, 2000);
    }
    catch (error) {
      console.log('HomeScreen.pushNotification error:', error);
    }
  };

  static navigationOptions = (navigator) => {
    let navParams = navigator.navigation.state.params;
    let isNavigating = false;
    let SCREEN_TRANSITION_FINISHED_DELAY_MS = 400;

    return {
      headerTitle: null,
      headerLeft: (
        <ToolbarButton
          imageSource={Images.SETTINGS_ICON}
          onPress={() => {
            if (!isNavigating) {
              isNavigating = true;
              navigator.navigation.navigate('SettingsScreen', {
                credentialId: navParams.credentialId
              });
              setTimeout(() => { isNavigating = false; },
               SCREEN_TRANSITION_FINISHED_DELAY_MS);
            }
          }} />
      ),
      headerRight: (
        <CallSecurityToolbarButton
          onPress={async () => {
            try {
              await call({
                number: navParams.securityTelephone,
                prompt: true
              });
            } catch(error) {
              console.log("Unable to call security. " + error);
            }
          }} />
      )
    };
  };

  // This function is called when the navigator state changes.
  //
  onNavigationStateChange = (prevNavState, newNavState) => {
    let prevScreenName = Utils.getNavigatorRouteName(prevNavState);
    let nextScreenName = Utils.getNavigatorRouteName(newNavState);

    if (nextScreenName !== prevScreenName) {
      GoogleAnalytics.trackScreenView(nextScreenName);
    }
  };

  render() {
    return (
      <HomeNavigator
        onNavigationStateChange={this.onNavigationStateChange}
        screenProps={{
          appNavigation: this.props.navigation,
          ...this.props.screenProps
        }} />
    );
  }
}

export { HomeScreen };
