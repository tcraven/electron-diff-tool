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
