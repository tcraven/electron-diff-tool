import React, { Component } from 'react';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  Alert,
  Modal,
  View
} from 'react-native';
import { Api } from 'src/services/api';
import { ToolbarButton } from 'src/components/toolbar-button';
import { Screen } from 'src/screens/screen';
import { Utils } from 'src/utils';
import { PartitionHeader } from 'src/components/partition-header';
import { HomeNavigator } from 'src/navigators';
import { GoogleAnalytics } from 'src/services/google-analytics';
import { FilterToolbarButton } from 'src/components/filter-toolbar-button';
import { MoreToolbarButton } from 'src/components/more-toolbar-button';
import { SettingsToolbarButton } from 'src/components/settings-toolbar-button';
import { EventBus } from 'src/services/event-bus';
import { Env } from 'src/services/env';
import { PeopleScreen } from "src/screens/people-screen";
import { CamerasScreen } from "src/screens/cameras-screen";

import Share from 'react-native-share';
import RNFS from 'react-native-fs';

global.gridList = 'list';

class HomeScreen extends Screen {

  constructor() {
    super();
    global.homeScreen = this;
    global.showMore = false;
  }
  
  static navigationOptions = (navigator) => {

    let navParams = navigator.navigation.state.params;
    let connections = (navParams ? navParams.connections : null) || [];
    let currentConnection = navParams ? navParams.currentConnection : null;
    let currentPartition = navParams ? navParams.currentPartition : null;
    let filter = navParams ? navParams.filter : null;
    let screenName = navParams ? navParams.screenName : null;
    let connectionStatus = navParams ? navParams.connectionStatus : null;
    return {
      headerTitle: (
        <View style={{ alignSelf: 'center' }}>
          { connections.length > 0 &&
            <PartitionHeader
              currentPartition={currentPartition}
              onPress={() => {
                console.log('PartitionHeader onPress');
                navParams.showPartitionMenu();
              }} />
          }
        </View>
      ),
      headerLeft: (
        <SettingsToolbarButton
          connection={currentConnection}
          connectionStatus={connectionStatus}
          onPress={() => {
            console.log('SettingsScreen');
            navigator.navigation.navigate('SettingsScreen');
          }} />
      ),
      headerRight: (
        <View style={{
          flexDirection:'row',
          marginRight: 10
        }}>

          <FilterToolbarButton
            screenName={screenName}
            filter={filter}
            onPress={() => {
              console.log('FilterMenu');
              navParams.showFilterMenu();
            }}/>

          {screenName == "PeopleScreen" &&
            <MoreToolbarButton
              onPress={() => {
                PeopleScreen.showMoreMenu();
              }}/>
          }

          {screenName == "CamerasScreen" &&
            <MoreToolbarButton
              onPress={() => {
                CamerasScreen.showMoreMenu();
              }}/>
          }

        </View>


      ),
      headerStyle: {
        backgroundColor: '#141414',
        borderBottomColor: '#1f4667',
        borderBottomWidth: 1.5
      }
    };
  };


  /*
  This function is called when the navigator state changes.
  */
  onNavigationStateChange = (prevNavState, newNavState, action) => {
    // console.log('onNavigationStateChange', prevNavState, newNavState, action);
    const newScreenName = Utils.getNavigatorRouteName(newNavState);
    const prevScreenName = Utils.getNavigatorRouteName(prevNavState);

    if (newScreenName !== prevScreenName) {
      GoogleAnalytics.trackScreenView(this.getEnv(), newScreenName);
    }

    this.props.navigation.setParams({
      screenName: newScreenName,
      currentConnection: this.getCurrentConnection(),
      connectionStatus: this.getConnectionStatus()
    });

    // TO DO: Remove global references
    global.CurrentScreenName = newScreenName;

    // Publish the homeTabChanged event for the new screen
    EventBus.publish('homeTabChanged', {
      screenName: newScreenName
    });
  };

  componentWillMount() {
    EventBus.subscribe('partitionChangeStarted', this.onPartitionChanged, this);
    EventBus.subscribe('partitionChangeFailed', this.onPartitionChanged, this);
    EventBus.subscribe('partitionChanged', this.onPartitionChanged, this);
    EventBus.subscribe('filterChanged', this.onFilterChanged, this);

    let screenName = 'ActivityLogScreen';

    this.props.navigation.setParams({
      showPartitionMenu: () => {
        this.showPartitionMenu();
      },
      showFilterMenu: () => {
        this.showFilterMenu();
      },
      connections: this.getConnections(),
      currentConnection: this.getCurrentConnection(),
      currentPartition: this.getCurrentPartition(),
      filter: this.getFilter(),
      screenName: screenName,
      connectionStatus: this.getConnectionStatus()
    });

    // Publish the homeTabChanged event for the initial screen
    EventBus.publish('homeTabChanged', {
      screenName: screenName
    });

    // Attempt to share CSV as attachment
    this.shareTestCsv();
  }

  async shareTestCsv() {
    console.log('QQQ');
    try {
      // Write the CSV file to the filesystem, so that the sharing
      // library is able to share it as an attachment on both Android
      // and iOS using the correct filename.
      let basePath = Utils.isAndroid() ?
        RNFS.ExternalStorageDirectoryPath :
        RNFS.DocumentDirectoryPath;

      let path = `${basePath}/test.csv`;

      // write the file
      let csvString = 'a,b,c\n1,2,Sîne klâwen durh die wolken sint geslagen';
      let fileResult = await RNFS.writeFile(
        path, csvString, 'utf8');

      console.log('QQQ', fileResult);

      // Share.open must be used for iOS - Share.shareSingle doesn't
      // handle the attachment properly.
      // 
      let shareResult = await Share.open({
        social: 'email',
        subject: 'Share CSV',
        message: 'Hello\n\nHere is a CSV as an attachment.\n\n',
        url: `file://${path}`
      });

      // let csvString = 'a,b,c\n1,2,Sîne klâwen durh die wolken sint geslagen';
      // let data = btoa(csvString);
      // let shareResult = await Share.shareSingle({  // open({
      //   social: 'email',
      //   subject: 'Share CSV',
      //   message: 'Hello\n\nHere is a CSV as an attachment.\n\n',
      //   url: `data:text/plain;base64,${data}`
      // });
    }
    catch (error) {
      console.log('QQQ Share error:', error);
    }
  }

  componentWillUnmount() {
    EventBus.subscribe('partitionChangeStarted', this.onPartitionChanged, this);
    EventBus.subscribe('partitionChangeFailed', this.onPartitionChanged, this);
    EventBus.unsubscribe('partitionChanged', this.onPartitionChanged, this);
    EventBus.unsubscribe('filterChanged', this.onFilterChanged, this);
  }

  onPartitionChanged(e) {
    this.props.navigation.setParams({
      connections: this.getConnections(),
      currentConnection: e.currentConnection,
      currentPartition: e.currentPartition
    });
  }

  onFilterChanged(e) {
    // console.log('onFilterChanged', e);
    this.props.navigation.setParams({
      filter: e.filter
    });
  }

  render() {
    return null;
    // return (
    //   <HomeNavigator
    //     onNavigationStateChange={this.onNavigationStateChange}
    //     screenProps={{
    //       appNavigation: this.props.navigation,
    //       ...this.props.screenProps
    //     }} />
    // );
  }

}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  label: {
    textAlign: 'center',
    margin: 10
  }
});


export { HomeScreen };
