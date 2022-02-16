import React, { useState } from "react";
import type { Node } from "react";
import { Alert, Linking, TextInput, ActivityIndicator, useColorScheme, Pressable, Button, Image, FlatList, StyleSheet, Text, SafeAreaView, View, ScrollView } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MenuView } from "@react-native-menu/menu";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Animated } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';

import { keys } from "./Constants";
import styles from "./Styles";
import epilogueStorage from "./Storage";

export function HomeScreen({ navigation }) {
	const is_dark = (useColorScheme() == "dark");
	const [ books, setBooks ] = useState();
	const [ bookshelves, setBookshelves ] = useState([]);
	const [ searchText, setSearchText ] = useState("");
  
	React.useEffect(() => {
		const unsubscribe = navigation.addListener("focus", () => {
			onFocus(navigation);
		});
		return unsubscribe;
	}, [navigation]);
  
	function onFocus(navigation) {		
		epilogueStorage.get(keys.authToken).then(auth_token => {
			if ((auth_token == null) || (auth_token.length == 0)) {
				navigation.navigate("SignIn");
			}
		});

		epilogueStorage.get("current_search").then(current_search => {
			if ((current_search == null) || (currentSearch.length == 0)) {
				loadBookshelves(navigation);
			}
		});
		
		setupLinking();
		setupProfileIcon();
	}
  
  	function setupLinking() {
		Linking.getInitialURL().then(url => {
			loadURL(url);
		});
		
		Linking.addEventListener("url", (event) => {
			loadURL(event.url);
		});
	}
  
	function loadURL(url) {
		if (url != undefined) {
			let pieces = url.split("/");
			let temp_token = pieces[pieces.length - 1];
			verifyToken(temp_token);
		}
	}
	
	function verifyToken(token) {		
		let form = new FormData();
		form.append("token", token);
		
		var options = {
			method: "POST",
			body: form
		};
		
		fetch("https://micro.blog/account/verify", options).then(response => response.json()).then(data => {
			if (data.error) {
				Alert.alert("Error signing in", data.error);
			}
			else {
				let username = data.username;
				let new_token = data.token;
				let blog_name = data.default_site;
	
				// if no pref for blog, load blogs and set default
				epilogueStorage.get(keys.currentBlogID).then(blog_id => {
					if ((blog_id == null) || (blog_id.length == 0)) {
						loadBlogs();
					}
				});
			
				// save token and load books
				epilogueStorage.set(keys.authToken, new_token).then(() => {
					loadBookshelves(navigation);

					// close sign-in screen if it was open
					navigation.goBack();				
				});

				// save current username
				epilogueStorage.set(keys.currentUsername, username).then(() => {
					setupProfileIcon();
				});
			}
		});
	}
  
  	function loadBlogs() {
		epilogueStorage.get(keys.authToken).then(auth_token => {
			var options = {
				headers: {
					"Authorization": "Bearer " + auth_token
				}
			};
						
			fetch("https://micro.blog/micropub?q=config", options).then(response => response.json()).then(data => {
				for (blog of data.destination) {
					if (blog["microblog-default"] == true) {
						let blog_id = blog.uid;
						let blog_name = blog.name;
						
						epilogueStorage.set(keys.currentBlogID, blog_id);
						epilogueStorage.set(keys.currentBlogName, blog_name);
					}
				}
			});			
		});
	}
  
	function loadBooks(bookshelf_id, handler = function() {}) {
		if (bookshelf_id == undefined) {
			return;
		}
		
		epilogueStorage.get(keys.authToken).then(auth_token => {
			var options = {
				headers: {
					"Authorization": "Bearer " + auth_token
				}
			};
			
			// console.log("loadBooks getBookshelves: ", JSON.stringify(bookshelves));
			for (let shelf of bookshelves) {
				if (shelf.id == bookshelf_id) {
					epilogueStorage.set("current_bookshelf", shelf);
				}
			}
			
			fetch("https://micro.blog/books/bookshelves/" + bookshelf_id, options).then(response => response.json()).then(data => {
				var new_items = [];
				for (let item of data.items) {
					var author_name = "";
					if (item.authors.length > 0) {
						author_name = item.authors[0].name;
					}
					new_items.push({
						id: item.id,
						isbn: item._microblog.isbn,
						title: item.title,
						image: item.image,
						author: author_name
					});
				}
				
				setBooks(new_items);
				handler();
			});		
		});
	}
  
	function loadBookshelves(navigation) {
		epilogueStorage.get(keys.authToken).then(auth_token => {
			var options = {
				headers: {
					"Authorization": "Bearer " + auth_token
				}
			};

			fetch("https://micro.blog/books/bookshelves", options).then(response => response.json()).then(data => {
				var new_items = [];
				for (let item of data.items) {
					var s;
					if (item._microblog.books_count == 1) {
						s = "1 book";
					}
					else {
						s = item._microblog.books_count + " books";
					}
					
					new_items.push({
						id: item.id.toString(),
						title: item.title,
						books_count: s
					});
				}
				
				setBookshelves(new_items);
				epilogueStorage.get("current_bookshelf").then(current_bookshelf => {
					if (current_bookshelf == null) {
						let first_bookshelf = new_items[0];
						epilogueStorage.set("current_bookshelf", first_bookshelf);
						current_bookshelf = first_bookshelf;
					}
					loadBooks(current_bookshelf.id);
					setupBookshelves(navigation, new_items, current_bookshelf.title);
				});
			});		
		});
	}

	function setupBookshelves(navigation, items, currentTitle) {
		navigation.setOptions({
			headerRight: () => (
				<MenuView
				onPressAction = {({ nativeEvent }) => {
					let shelf_id = nativeEvent.event;
					loadBooks(shelf_id, function() {
						epilogueStorage.get("current_bookshelf").then(current_bookshelf => {
							setupBookshelves(navigation, bookshelves, current_bookshelf.title);
						});
					});
				}}
				actions = {items}
				>
					<View style={styles.navbarBookshelf}>
						<Image style={is_dark ? [ styles.navbarBookshelfIcon, styles.dark.navbarBookshelfIcon ] : styles.navbarBookshelfIcon} source={require("../images/books.png")} />
						<Text style={is_dark ? [ styles.navbarBookshelfTitle, styles.dark.navbarBookshelfTitle ] : styles.navbarBookshelfTitle}>{currentTitle}</Text>
					</View>
				</MenuView>
			)
		});
	}
	
	function setupProfileIcon() {
		epilogueStorage.get(keys.currentUsername).then(username => {
			let avatar_url = "https://micro.blog/" + username + "/avatar.jpg";
			navigation.setOptions({
				headerLeft: () => (
					<Pressable onPress={() => { onSignOut(); }}>
						<Image style={styles.profileIcon} source={{ uri: avatar_url }} />
					</Pressable>
				)
			});		
		});
	}	
	
	function onSignOut() {		
		Alert.alert("Sign out of Epilogue?", "", [
			{
				text: "Cancel",
				style: "cancel"
			},
			{
				text: "Sign Out",
				onPress: () => {
					clearSettings();
					setTimeout(function() {
						navigation.navigate("SignIn");
					}, 1000);
				}
			}
		]);
	}
	
	function clearSettings() {
		epilogueStorage.remove(keys.authToken);
		epilogueStorage.remove(keys.currentUsername);		
	}
	
	function sendSearch(searchText) {
		let q = encodeURIComponent(searchText);
	
		var options = {
		};
		
		fetch("https://www.googleapis.com/books/v1/volumes?q=" + q, options).then(response => response.json()).then(data => {
			var new_items = [];
			for (let book_item of data.items) {
				var author_name = "";
				if (book_item.volumeInfo.authors.length > 0) {
					author_name = book_item.volumeInfo.authors[0];
				}

				var cover_url = "";
				if (book_item.volumeInfo.imageLinks != undefined) {
					cover_url = book_item.volumeInfo.imageLinks.smallThumbnail;
					if (cover_url.includes("http://")) {
						cover_url = cover_url.replace("http://", "https://");
					}					
				}

				let isbns = book_item.volumeInfo.industryIdentifiers;
				var best_isbn = "";
				for (let isbn of isbns) {
					if (isbn.type == "ISBN_13") {
						best_isbn = isbn.identifier;
						break;
					}
					else if (isbn.type == "ISBN_10") {
						best_isbn = isbn.identifier;
					}
				}

				if ((best_isbn.length > 0) && (cover_url.length > 0)) {
					new_items.push({
						id: book_item.id,
						isbn: best_isbn,
						title: book_item.volumeInfo.title,
						image: cover_url,
						author: author_name
					});
				}
			}
			
			setBooks(new_items);
		});
	}
	
	function onShowBookPressed(item) {
		epilogueStorage.get("current_bookshelf").then(current_bookshelf => {
			var params = {
				id: item.id,
				isbn: item.isbn,
				title: item.title,
				image: item.image,
				author: item.author,
				bookshelves: bookshelves,
				current_bookshelf: current_bookshelf
			};
			navigation.navigate("Details", params);
		});
	}
  
	function removeFromBookshelf() {	  
	}

	function onChangeSearch(text) {
		setSearchText(text);
		
		// if we're clearing the text, wait a second and then send it
		// otherwise the user is still typing
		if (text.length == 0) {
			setTimeout(function() {
				epilogueStorage.remove("current_search").then(() => {
					epilogueStorage.get("current_bookshelf").then(current_bookshelf => {
						loadBooks(current_bookshelf.id);
					});				
				});
			}, 1000);
		}
	}

	function onSearch() {
		if (searchText.length > 0) {
			epilogueStorage.set("current_search", searchText);
			sendSearch(searchText);
		}
		else {
			epilogueStorage.remove("current_search").then(() => {
				epilogueStorage.get("current_bookshelf").then(current_bookshelf => {
					loadBooks(current_bookshelf.id);
				});				
			});
		}
	}

	renderRightActions = (progress, dragX) => {
		const trans = dragX.interpolate({
			inputRange: [0, 50, 100, 101],
			outputRange: [0, 0, 0, 1],
		});
	
		return (
			<RectButton style={styles.removeAction} onPress={() => {
				removeFromBookshelf();
			}}>
			<View style={styles.removeContainer}>
				<Animated.Text style={[ styles.removeText, {
					transform: [{ translateX: trans }],
				}]}>
					Remove
				</Animated.Text>
				</View>
			</RectButton>
		);
	};

	return (
		<View style={is_dark ? [ styles.container, styles.dark.container ] : styles.container}>
			<TextInput style={is_dark ? [ styles.searchField, styles.dark.searchField ] : styles.searchField} onChangeText={onChangeSearch} value={searchText} onEndEditing={onSearch} returnKeyType="search" placeholder="Search for books to add" clearButtonMode="always" />
			<FlatList
				data = {books}
				renderItem = { ({item}) => 
				<Swipeable renderRightActions={renderRightActions}>
					<Pressable onPress={() => { onShowBookPressed(item) }}>
						<View style={is_dark ? [ styles.item, styles.dark.item ] : styles.item}>
							<Image style={styles.bookCover} source={{ uri: item.image.replace("http://", "https://") }} />
							<View style={styles.bookItem}>
								<Text style={is_dark ? [ styles.bookTitle, styles.dark.bookTitle ] : styles.bookTitle} ellipsizeMode="tail" numberOfLines={2}>{item.title}</Text>
								<Text style={is_dark ? [ styles.bookAuthor, styles.dark.bookAuthor ] : styles.bookAuthor}>{item.author}</Text>
							</View>
						</View>
					</Pressable>
				</Swipeable>
				}
				keyExtractor = { item => item.id }
			/>
		</View>
	);
}