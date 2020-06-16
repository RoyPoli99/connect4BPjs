//starts the game
bp.registerBThread("game_start", function(){
    bp.sync({request:bp.Event("white_turn")});
})

//enforces the turns between players
bp.registerBThread("enforce_turns", function(){ 
    while(true){
        bp.sync({waitFor:bp.Event("white_turn"),
                block:bp.Event("red_turn")});
        bp.sync({waitFor:bp.Event("red_turn"),
                block:bp.Event("white_turn")});
    }
})

//a logger that keeps track of the current board and prints it in the end of the game
bp.registerBThread("draw_board", function(){
    var board = [
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
    ];
    var board_print = function(){
        for(var i = 5; i >= 0; i--)
            bp.log.info(board[i]);
        }
    var move_event = bp.EventSet("move_event", function(evt) {
            return (evt.data==null) ?
                      false :
                      evt.data.type && (evt.data.type=="move" || evt.data.type=="win" || evt.data.type=="draw");
        });
    while(true){
        var move = bp.sync({waitFor:move_event});
        if(move.data.type == "move"){
            if(move.data.color == "white"){
                board[move.data.row][move.data.col] = "W";
            }
            else{
                board[move.data.row][move.data.col] = "R";
            }
            bp.sync({request:bp.Event("done_logging")});
        }
        else{
            board_print();
        }
    }
})

//white player move
bp.registerBThread("white_move", function(){
    var choose_column_event = bp.EventSet("choose_column", function(evt) {
        return (evt.data==null) ?
                  false :
                  evt.data.type && evt.data.type=="choose_col";
    });
    while(true){
        bp.sync({waitFor:bp.Event("white_turn")})
        bp.sync({request:bp.Event("get_col")});     //requests a column to play
        var chosen_col = bp.sync({waitFor:choose_column_event});
        bp.sync({request:bp.Event("move", {type: "move", color:"white", row:chosen_col.data.row, col:chosen_col.data.col})});
        bp.sync({waitFor:bp.Event("done_logging")});    //waits for the logger to finish logging the move before passing the turn
        bp.sync({request:bp.Event("red_turn")});
    }
})

//red player move
bp.registerBThread("red_move", function(){
    var choose_column_event = bp.EventSet("choose_column", function(evt) {
        return (evt.data==null) ?
                  false :
                  evt.data.type && evt.data.type=="choose_col";
    });
    while(true){
        bp.sync({waitFor:bp.Event("red_turn")})
        bp.sync({request:bp.Event("get_col")});
        var chosen_col = bp.sync({waitFor:choose_column_event});
        bp.sync({request:bp.Event("move", {type: "move", color:"red", row:chosen_col.data.row, col:chosen_col.data.col})});
        bp.sync({waitFor:bp.Event("done_logging")});
        bp.sync({request:bp.Event("white_turn")});
    }
})

//generates legal moves for player, and checks for a draw
bp.registerBThread("choose_random_column", function(){
    var cols = [{col:0, val:0},{col:1, val:0},{col:2, val:0},{col:3, val:0},{col:4, val:0},{col:5, val:0},{col:6, val:0}];
    while(true){
        bp.sync({waitFor:bp.Event("get_col")});
        var index = Math.floor(Math.random() * cols.length);    //randoms an available column
        bp.sync({request:bp.Event("choose_col", {type:"choose_col", row:cols[index].val, col:cols[index].col})});
        cols[index].val++;
        if(cols[index].val == 6)
            cols.splice(index, 1);  //if the column is full then removes from cols array
        if(cols.length == 0){
            bp.sync({request:bp.Event("draw_event", {type:"draw"})});   //if cols array is empty then no possible moves available
            break;
        }
        }
})

//waits for a draw and then ends the game
bp.registerBThread("detect_draw", function(){
    bp.sync({waitFor:bp.Event("draw_event")});
    bp.sync({request:bp.Event("game ends in a draw!"), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
})

//the following are 4 loops that generates a bthread for every possible win
//each bthread looks for 4 certain moves of the same color that would result in a win

//looks for wins by way of a row
for(var row = 0; row < 6; row++){
    for(var col = 0; col < 4; col++){
        (function(row,col){
            bp.registerBThread("row_win("+row+","+col+")", function(){
                var chosen_color = "not_chosen";
                var row_move_event = bp.EventSet("row_move_event", function(evt) {
                    return (evt.data==null) ?
                              false :
                              evt.data.type && evt.data.type=="move" && evt.data.row == row 
                              && (evt.data.col >= col && evt.data.col <= col + 3) 
                              && (evt.data.color == chosen_color || chosen_color == "not_chosen");
                    });
                for(var index = 0; index < 4; index++){
                    var row_move = bp.sync({waitFor:row_move_event});
                    if(chosen_color == "not_chosen")
                        chosen_color = row_move.data.color; //if its the first of the 4 moves then sets the color to look for
                }
                bp.sync({waitFor:bp.Event("done_logging"), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
                bp.sync({request:bp.Event("win", {type: "win", color: chosen_color}), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
                bp.sync({block:[bp.Event("white_turn"),bp.Event("red_turn")]})
            });
        })(row,col);
    }
}

//looks for wins by way of a column
for(var row = 0; row < 3; row++){
    for(var col = 0; col < 7; col++){
        (function(row,col){
            bp.registerBThread("col_win("+row+","+col+")", function(){
                var chosen_color = "not_chosen";
                var col_move_event = bp.EventSet("col_move_event", function(evt) {
                    return (evt.data==null) ?
                              false :
                              evt.data.type && evt.data.type=="move" && evt.data.col == col 
                              && (evt.data.row >= row && evt.data.row <= row + 3) 
                              && (evt.data.color == chosen_color || chosen_color == "not_chosen");
                    });
                for(var index = 0; index < 4; index++){
                    var col_move = bp.sync({waitFor:col_move_event});
                    if(chosen_color == "not_chosen")
                        chosen_color = col_move.data.color;
                }
                bp.sync({waitFor:bp.Event("done_logging"), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
                bp.sync({request:bp.Event("win", {type: "win", color: chosen_color}), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
                bp.sync({block:[bp.Event("white_turn"),bp.Event("red_turn")]})
            });
        })(row,col);
    }
}

//looks for wins by way of a diagonal going up
for(var row = 0; row < 4; row++){
    for(var col = 0; col < 3; col++){
        (function(row,col){
            bp.registerBThread("up_diagonal_win("+row+","+col+")", function(){
                var chosen_color = "not_chosen";
                var up_diagonal_move_event = bp.EventSet("up_diagonal_move_event", function(evt) {
                    return (evt.data==null) ?
                              false :
                              evt.data.type && evt.data.type=="move" && evt.data.row - row == evt.data.col - col
                              && (evt.data.row - row >= row && evt.data.row - row <= row + 3) 
                              && (evt.data.color == chosen_color || chosen_color == "not_chosen");
                    });
                for(var index = 0; index < 4; index++){
                    var up_diagonal_move = bp.sync({waitFor:up_diagonal_move_event});
                    if(chosen_color == "not_chosen")
                        chosen_color = up_diagonal_move.data.color;
                }
                bp.sync({waitFor:bp.Event("done_logging"), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
                bp.sync({request:bp.Event("win", {type: "win", color: chosen_color}), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
                bp.sync({block:[bp.Event("white_turn"),bp.Event("red_turn")]})
            });
        })(row,col);
    }
}

//looks for wins by way of a diagonal going down
for(var row = 3; row < 6; row++){
    for(var col = 0; col < 3; col++){
        (function(row,col){
            bp.registerBThread("down_diagonal_win("+row+","+col+")", function(){
                var chosen_color = "not_chosen";
                var down_diagonal_move_event = bp.EventSet("down_diagonal_move_event", function(evt) {
                    return (evt.data==null) ?
                              false :
                              evt.data.type && evt.data.type=="move" && row - evt.data.row == evt.data.col - col
                              && (evt.data.col - col >= col && evt.data.col - col <= col + 3) 
                              && (evt.data.color == chosen_color || chosen_color == "not_chosen");
                    });
                for(var index = 0; index < 4; index++){
                    var down_diagonal_move = bp.sync({waitFor:down_diagonal_move_event});
                    if(chosen_color == "not_chosen")
                        chosen_color = down_diagonal_move.data.color;
                }
                bp.sync({waitFor:bp.Event("done_logging"), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
                bp.sync({request:bp.Event("win", {type: "win", color: chosen_color}), block:[bp.Event("white_turn"),bp.Event("red_turn")]});
                bp.sync({block:[bp.Event("white_turn"),bp.Event("red_turn")]})
            });
        })(row,col);
    }
}

//waits for a win and ends the game
bp.registerBThread("detect_win", function(){
    var win_event = bp.EventSet("win_event", function(evt) {
        return (evt.data==null) ?
                  false :
                  evt.data.type && evt.data.type=="win";
    });
    var winner = bp.sync({waitFor:win_event});
    bp.sync({request:bp.Event(winner.data.color + " wins!")});
    bp.sync({block:[bp.Event("white_turn"),bp.Event("red_turn")]})
})
