"use strict";

/**
 * Copyright 2014 the HtmlGoBoard project authors.
 * All rights reserved.
 * Project  WebSDK
 * Author   Ilya Kirillov
 * Date     18.11.14
 * Time     22:59
 */

var EBoardMode =
{
    Move          : 0,
    CountScores   : 1,
    AddRemove     : 2,
    AddMarkTr     : 3,
    AddMarkSq     : 4,
    AddMarkCr     : 5,
    AddMarkX      : 6,
    AddMarkTx     : 7,
    AddMarkNum    : 8,
    ScoreEstimate : 9,
    AddMarkColor  : 10
};

function CDrawingBoard(oDrawing)
{
    this.m_oDrawing    = oDrawing;
    this.m_oGameTree   = null;
    this.m_oLogicBoard = null;

    this.m_eMode       = EBoardMode.Move;
    this.m_bRulers     = false;

    this.m_dKoeffOffsetY = 0;
    this.m_dKoeffOffsetX = 0;
    this.m_dKoeffCellW   = 0;
    this.m_dKoeffCellH   = 0;
    this.m_dKoeffDiam    = 0;

    this.m_oBoardPosition = {};

    this.m_oCreateWoodyId = null; // Id таймера по которому рисуется красивая доска.

    this.m_oImageData =
    {
        W           : 0,
        H           : 0,
        W2          : 0,
        H2          : 0,
        StoneDiam   : 0,
        ShadowOff   : 0,
        HandiRad    : 2,
        Lines       : null,
        Handi       : null,
        Board       : null,
        BlackStone  : null,
        WhiteStones : new Array(),
        WhiteStones2: new Array(361),
        BlackTarget : null,
        WhiteTarget : null,

        ResizeBoard : null,

        X_Black     : null,
        X_White     : null,
        Tr_Black    : null,
        Tr_White    : null,
        Sq_Black    : null,
        Sq_White    : null,
        Ter_Black   : null,
        Ter_White   : null,
        Ter_Black2  : null,
        Ter_White2  : null,
        LastMove    : null,
        Cr_Black    : null,
        Cr_White    : null,

        RcolorTarget: null,
        GcolorTarget: null,
        BcolorTarget: null,
        AcolorTarget: null
    };

    this.m_bTrueColorBoard   = true;
    this.m_bTrueColorStones  = true;
    this.m_bShellWhiteStones = true;
    this.m_bShadows          = true;
    this.m_oWhiteColor       = new CColor(255, 255, 255, 255);
    this.m_oBlackColor       = new CColor(0, 0, 0, 255);
    this.m_oBoardColor       = new CColor(231, 188, 95, 255);
    this.m_oLinesColor       = new CColor(0, 0, 0, 255);
    this.m_bDarkBoard        = false;

    this.m_oVariantsColor   = new CColor(255,0,0, 128);

    this.HtmlElement =
    {
        Control : null,

        Board    : {Control : null}, // Канва для отрисовки текстурной доски.
        Lines    : {Control : null}, // Канва для отрисовки линий.
        Stones   : {Control : null}, // Канва для отрисовки камней.
        Colors   : {Control : null}, // Канва для рисования цветом.
        Shadow   : {Control : null}, // Канва для теней от камней.
        Variants : {Control : null}, // Канва для отрисовки вариантов.
        Marks    : {Control : null}, // Канва для отрисовки отметок
        Target   : {Control : null}, // Канва для отрисовки курсора в виде камня.
        Event    : {Control : null}, // Div для обработки сообщений мыши и клавиатуры.

        LinkedControls : []          // Контролы, которые нужно ресайзить из-за внутренних изменений доски
    };

    this.m_oLastTargetPos = { X : -1, Y : -1 };
    this.m_oColorMarks = {};

    this.m_oMarks = {};
    this.m_oLastMoveMark = -1;

    // Параметры, которые контролируют, какую часть доски мы отрисовываем
    this.m_oViewPort = {X0 : 0, Y0 : 0, X1 : 18, Y1 : 18};

    this.m_oPresentation = null;

    this.m_bMouseDown = false;

    var oThis = this;

    this.private_OnMouseMove = function(e)
    {
        check_MouseMoveEvent(e);
        var oPos = oThis.private_UpdateMousePos(global_mouseEvent.X, global_mouseEvent.Y);
        oPos = oThis.private_GetBoardPosByXY(oPos.X, oPos.Y);
        oThis.private_MoveTarget(oPos.X, oPos.Y, global_mouseEvent, false);
    };
    this.private_OnMouseOut = function(e)
    {
        check_MouseMoveEvent(e);
        oThis.m_bMouseDown = false;
        oThis.private_HideTarget();
    };
    this.private_OnMouseDown = function(e)
    {
        check_MouseDownEvent(e, true);
        oThis.m_bMouseDown = true;
        oThis.HtmlElement.Event.Control.HtmlElement.focus();
        var oPos = oThis.private_UpdateMousePos(global_mouseEvent.X, global_mouseEvent.Y);
        oPos = oThis.private_GetBoardPosByXY(oPos.X, oPos.Y);
        oThis.private_HandleMouseDown(oPos.X, oPos.Y, global_mouseEvent);

        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    this.private_OnMouseUp = function(e)
    {
        oThis.m_bMouseDown = false;
    };
    this.private_OnKeyDown = function(e)
    {
        check_KeyboardEvent(e);

        // Обрабатываем Shift при добавлении/удалении камней
        if (16 === global_keyboardEvent.KeyCode && EBoardMode.AddRemove === oThis.Get_Mode())
        {
            global_mouseEvent.ShiftKey = true;
            oThis.private_UpdateTarget();
        }
        else if ((16 === global_keyboardEvent.KeyCode || 17 === global_keyboardEvent.KeyCode) && EBoardMode.AddMarkColor === oThis.Get_Mode())
        {
            if (16 === global_keyboardEvent.KeyCode)
                global_mouseEvent.ShiftKey = true;
            else if (17 === global_keyboardEvent.KeyCode)
                global_mouseEvent.CtrlKey = true;

            oThis.private_UpdateTarget();
        }
        else
            oThis.private_HandleKeyDown(global_keyboardEvent);

        e.preventDefault();
    };
    this.private_OnKeyUp = function(e)
    {
        check_KeyboardEvent(e);

        // Обрабатываем Shift при добавлении/удалении камней
        if (16 === global_keyboardEvent.KeyCode && EBoardMode.AddRemove === oThis.Get_Mode())
        {
            global_mouseEvent.ShiftKey = false;
            oThis.private_UpdateTarget();
        }
        else if ((16 === global_keyboardEvent.KeyCode || 17 === global_keyboardEvent.KeyCode) && EBoardMode.AddMarkColor === oThis.Get_Mode())
        {
            if (16 === global_keyboardEvent.KeyCode)
                global_mouseEvent.ShiftKey = false;
            else if (17 === global_keyboardEvent.KeyCode)
                global_mouseEvent.CtrlKey = false;

            oThis.private_UpdateTarget();
        }
    };
    this.private_StartDrawingTimer = function()
    {
        return setTimeout(function()
        {
            oThis.private_CreateTrueColorBoard();
            oThis.private_CreateLines();
            oThis.private_CreateTrueColorStones();
            oThis.private_CreateShadows();
            oThis.private_CreateMarks();
            oThis.private_OnResize();

            oThis.m_oImageData.ResizeBoard = oThis.Get_FullImage();
        }, 20);
    };
    this.private_OnDragover = function(e)
    {
        e.preventDefault();
        return false;
    };
    this.private_OnDrop = function(e)
    {
        e.preventDefault();

        if (e.dataTransfer.files.length > 0 && FileReader)
        {
            var oFile = e.dataTransfer.files[0];
            var oReader = new FileReader();
            oReader.onload = function(event)
            {
                oThis.m_oGameTree.Load_Sgf(event.target.result);
            };

            oReader.readAsText(oFile);

            oThis.Focus();
        }
    };
}

CDrawingBoard.prototype.Init = function(sName, GameTree)
{
    if (this.m_oDrawing)
        this.m_oDrawing.Register_Board(this);

    this.m_oGameTree   = GameTree;
    this.m_oLogicBoard = GameTree.Get_Board();
    this.m_oGameTree.Set_DrawingBoard(this);

    this.HtmlElement.Control = CreateControlContainer(sName);
    var oElement = this.HtmlElement.Control.HtmlElement;

    var sBoardName    = sName + "_BoardCanvas";
    var sLinesName    = sName + "_LinesCanvas";
    var sColorName    = sName + "_ColorCanvas";
    var sShadowsName  = sName + "_ShadowsCanvas";
    var sStonesName   = sName + "_StonesCanvas";
    var sVariantsName = sName + "_VariantsCanvas";
    var sMarksName    = sName + "_MarksCanvas";
    var sTargetName   = sName + "_TargetCanvas";
    var sEventName    = sName + "_EventDiv";

    // Сначала заполняем Div нужными нам элементами
    this.private_CreateCanvasElement(oElement, sBoardName);
    this.private_CreateCanvasElement(oElement, sLinesName);
    this.private_CreateCanvasElement(oElement, sColorName);
    this.private_CreateCanvasElement(oElement, sShadowsName);
    this.private_CreateCanvasElement(oElement, sStonesName);
    this.private_CreateCanvasElement(oElement, sVariantsName);
    this.private_CreateCanvasElement(oElement, sMarksName);
    this.private_CreateCanvasElement(oElement, sTargetName);
    var oEventDiv = this.private_CreateDivElement(oElement, sEventName);

    // Теперь выставляем настройки для созданных элементов. Для CDrawingBoard все внутренние элементы будут
    // растягиваться по ширине Div, в которой они лежат.
    var oControl = this.HtmlElement.Control;
    this.private_FillHtmlElement(this.HtmlElement.Board,    oControl, sBoardName);
    this.private_FillHtmlElement(this.HtmlElement.Lines,    oControl, sLinesName);
    this.private_FillHtmlElement(this.HtmlElement.Colors,   oControl, sColorName);
    this.private_FillHtmlElement(this.HtmlElement.Shadow,   oControl, sShadowsName);
    this.private_FillHtmlElement(this.HtmlElement.Stones,   oControl, sStonesName);
    this.private_FillHtmlElement(this.HtmlElement.Variants, oControl, sVariantsName);
    this.private_FillHtmlElement(this.HtmlElement.Marks,    oControl, sMarksName);
    this.private_FillHtmlElement(this.HtmlElement.Target,   oControl, sTargetName);
    this.private_FillHtmlElement(this.HtmlElement.Event,    oControl, sEventName);

    oEventDiv.onmousemove     = this.private_OnMouseMove;
    oEventDiv.onmouseout      = this.private_OnMouseOut;
    oEventDiv.onmousedown     = this.private_OnMouseDown;
    oEventDiv.onmouseup       = this.private_OnMouseUp;
    oEventDiv.onkeydown       = this.private_OnKeyDown;
    oEventDiv.onkeyup         = this.private_OnKeyUp;
    oEventDiv.tabIndex        = -1;   // Этот параметр нужен, чтобы принимать сообщения клавиатуры (чтобы на этой div вставал фокус)
    oEventDiv.style.hidefocus = true; // Убираем рамку фокуса в IE
    oEventDiv.style.outline   = 0;    // Убираем рамку фокуса в остальных браузерах
    oEventDiv['ondragover']   = this.private_OnDragover; // Эти события добавляем таким образом, чтобы
    oEventDiv['ondrop']       = this.private_OnDrop;     // минимизатор не изменил названия.

    return oControl;
};
CDrawingBoard.prototype.Add_LinkedControl = function(oControl)
{
    this.HtmlElement.LinkedControls.push(oControl);
};
CDrawingBoard.prototype.Focus = function()
{
    this.HtmlElement.Event.Control.HtmlElement.focus();
};
CDrawingBoard.prototype.Set_Rulers = function(bRulers)
{
    if (bRulers !== this.m_bRulers)
    {
        this.m_bRulers = bRulers;

        for (var Index = 0, Count = this.HtmlElement.LinkedControls.length; Index < Count; Index++)
        {
            var Control = this.HtmlElement.LinkedControls[Index];
            Control.Resize(Control.width, Control.height);
        }

        this.On_Resize(true);
    }
};
CDrawingBoard.prototype.Set_ShellWhiteStones = function(Value)
{
    this.m_bShellWhiteStones = Value;
};
CDrawingBoard.prototype.Get_FullImage = function()
{
    var Canvas = document.createElement("canvas");
    var Context = Canvas.getContext("2d");

    Canvas.width  = this.HtmlElement.Board.Control.HtmlElement.width;
    Canvas.height = this.HtmlElement.Board.Control.HtmlElement.height;

    Context.drawImage(this.HtmlElement.Board.Control.HtmlElement, 0, 0);
    Context.drawImage(this.HtmlElement.Lines.Control.HtmlElement, 0, 0);
    Context.drawImage(this.HtmlElement.Shadow.Control.HtmlElement, 0, 0);
    Context.drawImage(this.HtmlElement.Stones.Control.HtmlElement, 0, 0);
    Context.drawImage(this.HtmlElement.Marks.Control.HtmlElement, 0, 0);

    return Canvas;
};
CDrawingBoard.prototype.Update_Size = function(bForce)
{
    var W = this.HtmlElement.Control.HtmlElement.clientWidth;
    var H = this.HtmlElement.Control.HtmlElement.clientHeight;

    var dKoef = this.Get_AspectRatio();
    var _W = H * dKoef;
    var _H = W / dKoef;

    if (_W <= W)
        W = _W;
    else
        H = _H;

    if (W !== this.m_oImageData.W2 || H !== this.m_oImageData.H2 || true === bForce)
    {
        this.m_oImageData.W2 = W;
        this.m_oImageData.H2 = H;

        this.HtmlElement.Control.Resize(W, H);

        this.private_UpdateKoeffs();
        this.private_OnResize(bForce);
    }
};
CDrawingBoard.prototype.Set_Presentation = function(oPresentation)
{
    this.m_oPresentation = oPresentation;
};
CDrawingBoard.prototype.On_Resize = function(bForce)
{
    this.private_UpdateKoeffs();
    this.private_OnResize(bForce);
};
CDrawingBoard.prototype.On_EndLoadSgf = function()
{
    if (null !== this.m_oPresentation)
    {
        if (this.m_oGameTree.Get_CurNode().Count_NodeNumber() >= this.m_oPresentation.Get_NodesCountInSlide())
            this.m_oPresentation.On_EndSgfSlide();
    }
};
CDrawingBoard.prototype.Set_ViewPort = function(X0, Y0, X1, Y1)
{
    var oSize = this.m_oLogicBoard.Get_Size();
    var nW = oSize.X, nH = oSize.Y;

    var nSize = Math.min(nW, nH);

    this.m_oViewPort.X0 = Math.max(0, Math.min(nSize - 1, X0));
    this.m_oViewPort.Y0 = Math.max(0, Math.min(nSize - 1, Y0));
    this.m_oViewPort.X1 = Math.max(0, Math.min(nSize - 1, X1));
    this.m_oViewPort.Y1 = Math.max(0, Math.min(nSize - 1, Y1));

    if (this.m_oViewPort.X1 <= this.m_oViewPort.X0)
    {
        this.m_oViewPort.X0 = 0;
        this.m_oViewPort.X1 = nSize - 1;
    }

    if (this.m_oViewPort.Y1 <= this.m_oViewPort.Y0)
    {
        this.m_oViewPort.Y0 = 0;
        this.m_oViewPort.Y1 = nSize - 1;
    }
};
CDrawingBoard.prototype.Draw_Sector = function(X, Y, Value)
{
    if (!this.m_oImageData.Lines)
        return;

    if (Value === this.m_oBoardPosition[Common_XYtoValue(X, Y)])
        return;

    var StonesCanvas = this.HtmlElement.Stones.Control.HtmlElement.getContext("2d");
    var ShadowCanvas = this.HtmlElement.Shadow.Control.HtmlElement.getContext("2d");

    var d = this.m_oImageData.StoneDiam;
    var Rad = (d - 1) / 2;
    var Lines = this.m_oImageData.Lines;
    var Off = this.m_oImageData.ShadowOff;

    if (true === this.private_IsPointInViewPort(X - 1, Y - 1))
    {
        var _X = Lines[X - 1].X - Rad;
        var _Y = Lines[Y - 1].Y - Rad;

        switch (Value)
        {
            case BOARD_BLACK:
            {
                StonesCanvas.putImageData(this.m_oImageData.BlackStone, _X, _Y);
                if (true === this.m_bShadows)
                    ShadowCanvas.putImageData(this.m_oImageData.Shadow, _X + Off, _Y + Off);
                break;
            }
            case BOARD_WHITE:
            {
                var Val = this.m_oImageData.WhiteStones2[X - 1 + (Y - 1) * this.m_oLogicBoard.Get_Size().X];
                StonesCanvas.putImageData(this.m_oImageData.WhiteStones[Val], _X, _Y);
                if (true === this.m_bShadows)
                    ShadowCanvas.putImageData(this.m_oImageData.Shadow, _X + Off, _Y + Off);
                break;
            }
            case BOARD_EMPTY:
            default:
            {
                StonesCanvas.clearRect(_X, _Y, d, d);
                if (true === this.m_bShadows)
                    ShadowCanvas.clearRect(_X + Off, _Y + Off, d, d);
                break;
            }
        }
    }

    this.m_oBoardPosition[Common_XYtoValue(X, Y)] = Value;

    if (X === this.m_oLastTargetPos.X && Y === this.m_oLastTargetPos.Y)
    {
        if (BOARD_BLACK === Value || BOARD_WHITE === Value)
            this.private_HideTarget();
        else
            this.private_UpdateTarget();
    }
};
CDrawingBoard.prototype.Show_Target = function()
{
    this.private_UpdateTarget();
};
CDrawingBoard.prototype.Remove_Mark = function(X, Y)
{
    var Place = Common_XYtoValue(X, Y);
    delete this.m_oMarks["" + Place];

    if (Place === this.m_oLastMoveMark)
        this.m_oMarks["" + Place] = new CDrawingMark(X, Y, EDrawingMark.Lm, "");
};
CDrawingBoard.prototype.Add_Mark = function(Mark)
{
    this.private_SetMark(Mark.Get_X(), Mark.Get_Y(), Mark);
};
CDrawingBoard.prototype.Remove_AllMarks = function()
{
    this.m_oMarks = {};
};
CDrawingBoard.prototype.Draw_Marks = function()
{
    this.private_DrawMarks();
};
CDrawingBoard.prototype.Draw_AllStones = function(OldLogicBoard)
{
    this.private_DrawTrueColorAllStones();
};
CDrawingBoard.prototype.Set_LastMoveMark = function(X, Y)
{
    this.private_SetLastMoveMark(X, Y);
};
CDrawingBoard.prototype.Set_EstimateMode = function(oEventsCatcher)
{
    this.m_oEstimateEventsCatcher = oEventsCatcher;
    this.Set_Mode(EBoardMode.ScoreEstimate);
};
CDrawingBoard.prototype.Set_Mode = function(eMode)
{
    if (!(this.m_oGameTree.m_nEditingFlags & EDITINGFLAGS_BOARDMODE) && eMode !== EBoardMode.ScoreEstimate)
        return;

    if (this.m_eMode !== eMode)
    {
        if (EBoardMode.CountScores === this.m_eMode)
            this.m_oGameTree.Clear_TerritoryPoints();

        this.m_eMode = eMode;
        this.private_UpdateTarget();

        if (EBoardMode.CountScores === eMode)
        {
            this.m_oLogicBoard.Init_CountScores();
            this.m_oGameTree.Count_Scores();
        }
        else if (EBoardMode.ScoreEstimate === eMode)
        {
            this.m_oLogicBoard.Init_ScoreEstimate();
            var oResult = this.m_oLogicBoard.Estimate_Scores(this);
            if (this.m_oEstimateEventsCatcher)
                this.m_oEstimateEventsCatcher.On_EstimateEnd(oResult.BlackReal, oResult.WhiteReal, oResult.BlackPotential, oResult.WhitePotential);
        }

        this.m_oGameTree.Update_InterfaceState();
    }
};
CDrawingBoard.prototype.Get_Mode = function()
{
    return this.m_eMode;
};
CDrawingBoard.prototype.Draw_Variant = function(X, Y)
{
    if (!this.m_oImageData.Lines)
        return;

    var d     = this.m_oImageData.StoneDiam / 2;
    var Rad   = (d - 1) / 2;
    var Lines = this.m_oImageData.Lines;

    if (true === this.private_IsPointInViewPort(X - 1, Y - 1))
    {
        var _X = Lines[X - 1].X;
        var _Y = Lines[Y - 1].Y;

        var VairantsCanvas = this.HtmlElement.Variants.Control.HtmlElement.getContext("2d");
        VairantsCanvas.fillStyle = this.m_oVariantsColor.ToString();
        VairantsCanvas.beginPath();
        VairantsCanvas.arc(_X, _Y, Rad, 0, 2 * Math.PI, false);
        VairantsCanvas.fill();
    }
};
CDrawingBoard.prototype.Clear_Variants = function()
{
    var VairantsCanvas = this.HtmlElement.Variants.Control.HtmlElement.getContext("2d");
    VairantsCanvas.clearRect(0, 0, this.m_oImageData.W, this.m_oImageData.H);
};
CDrawingBoard.prototype.Get_AspectRatio = function()
{
    var oSize = this.m_oLogicBoard.Get_Size();
    var nW = oSize.X, nH = oSize.Y;

    // Работаем только с квадратными досками
    var nSize = Math.min(nW, nH);

    // Высчитаем суммарный абсолютный размер доски и абсолютные сдвиги до начала сетки
    var dAbsBoardW = (this.m_oViewPort.X1 - this.m_oViewPort.X0) * g_dBoardCellW + 2 * g_dBoardHorOffset;
    var dAbsBoardH = (this.m_oViewPort.Y1 - this.m_oViewPort.Y0) * g_dBoardCellW + 2 * g_dBoardHorOffset;

    // Под линейки доски мы оставляем по половине клеточки с каждой стороны, т.е. суммарно
    // это как будто логическая доска размером на 1 больше.
    if (true === this.m_bRulers)
    {
        dAbsBoardW += g_dBoardCellW;
        dAbsBoardH += g_dBoardCellW;
    }

    // Если доска рисуется не целиком, тогда добавляем полклетки под продолжение сетки
    if (this.m_oViewPort.X0 > 0)
        dAbsBoardW += g_dBoardCellW_2 / 2;

    if (this.m_oViewPort.X1 < nSize - 1)
        dAbsBoardW += g_dBoardCellW_2 / 2;

    if (this.m_oViewPort.Y0 > 0)
        dAbsBoardH += g_dBoardCellW_2 / 2;

    if (this.m_oViewPort.Y1 < nSize - 1)
        dAbsBoardH += g_dBoardCellW_2 / 2;

    return (dAbsBoardW / dAbsBoardH);
};
CDrawingBoard.prototype.private_CreateCanvasElement = function(oParentElement, sName)
{
    var oElement = document.createElement("canvas");
    oElement.setAttribute("id", sName);
    oElement.setAttribute("style", "position:absolute;padding:0;margin:0;");
    oElement.setAttribute("oncontextmenu", "return false;");
    oParentElement.appendChild(oElement);
    return oElement;
};
CDrawingBoard.prototype.private_CreateDivElement = function(oParentElement, sName)
{
    var oElement = document.createElement("div");
    oElement.setAttribute("id", sName);
    oElement.setAttribute("style", "position:absolute;padding:0;margin:0;");
    oElement.setAttribute("oncontextmenu", "return false;");
    oParentElement.appendChild(oElement);
    return oElement;
};
CDrawingBoard.prototype.private_FillHtmlElement = function(oElement, oParentControl, sName)
{
    oElement.Control = CreateControlContainer(sName);
    var oControl = oElement.Control;
    oControl.Bounds.SetParams(0, 0, 1000, 1000, false, false, false, false, -1,-1);
    oControl.Anchor = (g_anchor_top | g_anchor_left | g_anchor_bottom | g_anchor_right);
    oParentControl.AddControl(oControl);
};
CDrawingBoard.prototype.private_UpdateMousePos = function(X, Y)
{
    var oPos = Common_FindPosition(this.HtmlElement.Board.Control.HtmlElement);
    return { X: X - oPos.X, Y : Y - oPos.Y };
};
CDrawingBoard.prototype.private_UpdateKoeffs = function()
{
    var oSize = this.m_oLogicBoard.Get_Size();
    var nW = oSize.X, nH = oSize.Y;

    // Работаем только с квадратными досками
    var nSize = Math.min(nW, nH);

    // Сначала скоректируем ViewPort
    this.m_oViewPort.X0 = Math.max(0, Math.min(nSize - 1, this.m_oViewPort.X0));
    this.m_oViewPort.Y0 = Math.max(0, Math.min(nSize - 1, this.m_oViewPort.Y0));
    this.m_oViewPort.X1 = Math.max(0, Math.min(nSize - 1, this.m_oViewPort.X1));
    this.m_oViewPort.Y1 = Math.max(0, Math.min(nSize - 1, this.m_oViewPort.Y1));

    if (this.m_oViewPort.X1 <= this.m_oViewPort.X0)
    {
        this.m_oViewPort.X0 = 0;
        this.m_oViewPort.X1 = nSize - 1;
    }

    if (this.m_oViewPort.Y1 <= this.m_oViewPort.Y0)
    {
        this.m_oViewPort.Y0 = 0;
        this.m_oViewPort.Y1 = nSize - 1;
    }

    // Высчитаем суммарный абсолютный размер доски и абсолютные сдвиги до начала сетки
    var dAbsBoardW = (this.m_oViewPort.X1 - this.m_oViewPort.X0) * g_dBoardCellW + 2 * g_dBoardHorOffset;
    var dAbsBoardH = (this.m_oViewPort.Y1 - this.m_oViewPort.Y0) * g_dBoardCellW + 2 * g_dBoardHorOffset;
    var dAbsHorOff = g_dBoardHorOffset;
    var dAbsVerOff = g_dBoardHorOffset;

    // Под линейки доски мы оставляем по половине клеточки с каждой стороны, т.е. суммарно
    // это как будто логическая доска размером на 1 больше.
    if (true === this.m_bRulers)
    {
        dAbsBoardW += g_dBoardCellW;
        dAbsBoardH += g_dBoardCellW;
        dAbsHorOff += g_dBoardCellW_2;
        dAbsVerOff += g_dBoardCellW_2;
    }

    // Если доска рисуется не целиком, тогда добавляем полклетки под продолжение сетки
    if (this.m_oViewPort.X0 > 0)
    {
        dAbsBoardW += g_dBoardCellW_2 / 2;
        dAbsHorOff += g_dBoardCellW_2 / 2;
    }

    if (this.m_oViewPort.X1 < nSize - 1)
        dAbsBoardW += g_dBoardCellW_2 / 2;

    if (this.m_oViewPort.Y0 > 0)
    {
        dAbsBoardH += g_dBoardCellW_2 / 2;
        dAbsVerOff += g_dBoardCellW_2 / 2;
    }

    if (this.m_oViewPort.Y1 < nSize - 1)
        dAbsBoardH += g_dBoardCellW_2 / 2;

    this.m_dKoeffCellH   = g_dBoardCellW / dAbsBoardH;
    this.m_dKoeffCellW   = g_dBoardCellW / dAbsBoardW;
    this.m_dKoeffOffsetX = dAbsHorOff / dAbsBoardW;
    this.m_dKoeffOffsetY = dAbsVerOff / dAbsBoardH;
    this.m_dKoeffDiam    = 4 / dAbsBoardW;
};
CDrawingBoard.prototype.private_OnResize = function(bForce)
{
    var W = this.HtmlElement.Board.Control.HtmlElement.width;
    var H = this.HtmlElement.Board.Control.HtmlElement.height;

    if (W != this.m_oImageData.W || H != this.m_oImageData.H || null === this.m_oImageData.Board || null !== this.m_oCreateWoodyId || true === bForce)
    {
        // Перестартовываем таймер, т.к. изменились размеры
        if (null !== this.m_oCreateWoodyId)
            clearTimeout(this.m_oCreateWoodyId);

        // Стартуем таймер с отрисовкой красивой доски
        this.m_oCreateWoodyId = this.private_StartDrawingTimer();

        this.private_CreateLines();

        // Пока рисуем простой вариант
        this.private_DrawSimpleBoard(W, H);
    }
    else
    {
        this.private_DrawTrueColorFullBoard();
    }
};
CDrawingBoard.prototype.private_DrawSimpleBoard = function(W, H)
{
    if (0 === W || 0 === H)
        return;

    if (null !== this.m_oImageData.ResizeBoard)
    {
        var Canvas = this.HtmlElement.Board.Control.HtmlElement.getContext("2d");
        Canvas.drawImage(this.m_oImageData.ResizeBoard, 0, 0, W, H);
        return;
    }

    // Доска
    var Board = this.HtmlElement.Board.Control.HtmlElement.getContext("2d");
    Board.fillStyle = this.m_oBoardColor.ToString();
    Board.fillRect(0, 0, W, H);

    // Разлиновка
    var LinesCanvas = this.HtmlElement.Lines.Control.HtmlElement.getContext("2d");

    var dCellW = this.m_dKoeffCellW * W;
    var dCellH = this.m_dKoeffCellH * H;
    var dOffX  = this.m_dKoeffOffsetX * W - this.m_oViewPort.X0 * dCellW;
    var dOffY  = this.m_dKoeffOffsetY * H - this.m_oViewPort.Y0 * dCellH;

    var oSize = this.m_oLogicBoard.Get_Size();

    LinesCanvas.clearRect(0, 0, W, H);
    LinesCanvas.strokeStyle = this.m_oLinesColor.ToString();

    var X0 = dOffX, X1 = X0 + (oSize.X - 1) * dCellW;
    for (var nY = 0; nY < oSize.Y; nY++)
    {
        var VerY = dOffY + nY * dCellH;
        LinesCanvas.beginPath();
        LinesCanvas.moveTo(X0, VerY);
        LinesCanvas.lineTo(X1, VerY);
        LinesCanvas.stroke();
    }

    var Y0 = dOffY, Y1 = Y0 + (oSize.Y - 1) * dCellH;
    for (var nX = 0; nX < oSize.X; nX++)
    {
        var HorX = dOffX + nX * dCellW;
        LinesCanvas.beginPath();
        LinesCanvas.moveTo(HorX, Y0);
        LinesCanvas.lineTo(HorX, Y1);
        LinesCanvas.stroke();
    }

    // Форовые точки
    if (oSize.X === oSize.Y && (9 === oSize.X || 13 === oSize.X || 19 === oSize.X))
    {
        LinesCanvas.fillStyle = this.m_oLinesColor.ToString();

        // Радиус делаем минимум 2 пикселя, чтобы форовая отметка всегда выделялась на
        // фоне сетки доски.
        var dRad = Math.max(2, this.m_dKoeffDiam * W / 2);
        var aPoints = [];
        switch (oSize.X)
        {
            case 9:  aPoints = [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]]; break;
            case 13: aPoints = [[3, 3], [3, 6], [3, 9], [6, 3], [6, 6], [6, 9], [9, 3], [9, 6], [9, 9]]; break;
            case 19: aPoints = [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]]; break;
        }

        for (var nPointIndex = 0, Count = aPoints.length; nPointIndex < Count; nPointIndex++)
        {
            var dX = dOffX + aPoints[nPointIndex][0] * dCellW;
            var dY = dOffY + aPoints[nPointIndex][1] * dCellW;

            LinesCanvas.beginPath();
            LinesCanvas.arc(dX, dY, dRad, 0, 2 * Math.PI, false);
            LinesCanvas.fill();
        }
    }

    // Рисуем все камни
    var StonesCanvas = this.HtmlElement.Stones.Control.HtmlElement.getContext("2d");
    StonesCanvas.clearRect(0, 0, W, H);
    StonesCanvas.strokeStyle = this.m_oLinesColor.ToString();
    StonesCanvas.lineWidth   = 1;

    var ColorB = (new CColor(0,0,0,255)).ToString();
    var ColorW = (new CColor(255,255,255,255)).ToString();

    for (var nY = 1; nY <= oSize.Y; nY++)
    {
        for (var nX = 1; nX <= oSize.X; nX++)
        {
            var Value = this.m_oLogicBoard.Get(nX, nY);

            if (BOARD_BLACK === Value )
                StonesCanvas.fillStyle = ColorB;
            else if (BOARD_WHITE === Value )
                StonesCanvas.fillStyle = ColorW;
            else
                continue;

            var dX = dOffX + (nX - 1) * dCellW;
            var dY = dOffY + (nY - 1) * dCellH;

            StonesCanvas.beginPath();
            StonesCanvas.arc(dX, dY, dCellW / 2, 0, Math.PI * 2, false);
            StonesCanvas.fill();
            StonesCanvas.stroke();
        }
    }

    // Очищаем другие канвы
    this.HtmlElement.Shadow.Control.HtmlElement.getContext("2d").clearRect(0, 0, W, H);
    this.HtmlElement.Variants.Control.HtmlElement.getContext("2d").clearRect(0, 0, W, H);
    this.HtmlElement.Marks.Control.HtmlElement.getContext("2d").clearRect(0, 0, W, H);
    this.HtmlElement.Target.Control.HtmlElement.getContext("2d").clearRect(0, 0, W, H);
};
CDrawingBoard.prototype.private_CreateTrueColorBoard = function()
{
    var W = this.HtmlElement.Board.Control.HtmlElement.width;
    var H = this.HtmlElement.Board.Control.HtmlElement.height;

    var Board = this.HtmlElement.Board.Control.HtmlElement.getContext("2d");

    if (0 === W || 0 === H)
        return;

    var ImageData = Board.createImageData(W, H);
    var f = 9e-1;

    var Red   = this.m_oBoardColor.r;
    var Green = this.m_oBoardColor.g;
    var Blue  = this.m_oBoardColor.b;

    var dCoffWf = new Array(W);
    for (var j = 0; j < W; j++)
    {
        dCoffWf[j] = (Math.tan(300 * j / W) + 1) / 2 + (Math.tan(100 * j / W) + 1) / 10;
    }

    var dCoffHf = new Array(H);
    for (var i = 0; i < H; i++)
    {
        dCoffHf[i] = 0.02 * Math.tan(i / H);
    }

    var r, g, b;

    if (true === this.m_bTrueColorBoard)
    {
        for (var i = 0; i < H; i++)
        {
            for (var j = 0; j < W; j++)
            {
                f = ( dCoffWf[j] + dCoffHf[i] ) * 40 + 0.5;
                f = f - Math.floor(f);

                if (f < 2e-1)
                    f = 1 - f / 2;
                else if (f < 4e-1)
                    f = 1 - ( 4e-1 - f ) / 2;
                else
                    f = 1;

                if (i == H - 1 || (i == H - 2 && j < W - 2) || j >= W - 1 || (j == W - 2 && i < H - 1))
                    f = f / 2;

                if (i == 0 || (i == 1 && j > 1) || j == 0 || (j == 1 && i > 1))
                {
                    r = 128 + Red * f / 2;
                    g = 128 + Green * f / 2;
                    b = 128 + Blue * f / 2;
                }
                else
                {
                    r = Red * f;
                    g = Green * f;
                    b = Blue * f;
                }

                var Index = (j + i * W) * 4;
                ImageData.data[Index + 0] = r;
                ImageData.data[Index + 1] = g;
                ImageData.data[Index + 2] = b;
                ImageData.data[Index + 3] = 255;
            }
        }
    }
    else
    {
        for (var i = 0; i < H; i++)
        {
            for (var j = 0; j < W; j++)
            {
                if (i == 0 || (i == 1 && j > 1) || j == 0 || (j == 1 && i > 1))
                {
                    r = 128 + Red / 2;
                    g = 128 + Green / 2;
                    b = 128 + Blue / 2;
                }
                else
                {
                    r = Red;
                    g = Green;
                    b = Blue;
                }

                var Index = (j + i * W) * 4;
                ImageData.data[Index + 0] = r;
                ImageData.data[Index + 1] = g;
                ImageData.data[Index + 2] = b;
                ImageData.data[Index + 3] = 255;
            }
        }
    }

    this.m_oImageData.Board = ImageData;
    this.m_oImageData.W = W;
    this.m_oImageData.H = H;

    this.m_oCreateWoodyId = null;
};
CDrawingBoard.prototype.private_DrawTrueColorFullBoard = function()
{
    this.private_DrawTrueColorBoard();
    this.private_DrawRulers();
    this.private_DrawTrueColorLines();
    this.private_RedrawTrueColorAllStones();
    this.private_DrawAllColorMarks();
    this.private_DrawMarks();
};
CDrawingBoard.prototype.private_DrawTrueColorBoard = function()
{
    var Board = this.HtmlElement.Board.Control.HtmlElement.getContext("2d");
    Board.putImageData(this.m_oImageData.Board, 0, 0);
};
CDrawingBoard.prototype.private_CreateLines = function()
{
    var W = this.m_oImageData.W;
    var H = this.m_oImageData.H;

    if (0 === W || 0 === H)
        return;

    var dHorOff = this.m_dKoeffOffsetX * W;
    var dVerOff = this.m_dKoeffOffsetY * H;
    var dCellH  = this.m_dKoeffCellH   * H;
    var dCellW  = this.m_dKoeffCellW   * W;

    // TODO: Пока мы реализуем для случая oSize.X == oSize.Y
    var oSize = this.m_oLogicBoard.Get_Size();
    var nSize = Math.min(oSize.X, oSize.Y);

    var Lines = new Array(oSize.X);

    var X_startoffset = dHorOff - dCellW * this.m_oViewPort.X0;
    var Y_startoffset = dVerOff - dCellH * this.m_oViewPort.Y0;

    var X, Y, X_G, Y_G, X_L, Y_L, X_G2, Y_G2, X_L2, Y_L2;
    for (var Index = 0; Index < nSize; Index++)
    {
        X    = X_startoffset + Index * dCellW;

        X_G  = X_startoffset + Index * dCellW + 0.6 * dCellW;
        X_L  = X_startoffset + Index * dCellW - 0.6 * dCellW;
        X_G2 = X_startoffset + Index * dCellW + 0.5 * dCellW;
        X_L2 = X_startoffset + Index * dCellW - 0.5 * dCellW;
        Y    = Y_startoffset + Index * dCellH;
        Y_G  = Y_startoffset + Index * dCellH + 0.6 * dCellH;
        Y_L  = Y_startoffset + Index * dCellH - 0.6 * dCellH;
        Y_G2 = Y_startoffset + Index * dCellH + 0.5 * dCellH;
        Y_L2 = Y_startoffset + Index * dCellH - 0.5 * dCellH;

        Lines[Index] =
        {
            X    : Math.floor(X    + 0.5),
            X_G  : Math.floor(X_G  + 0.5),
            X_L  : Math.floor(X_L  + 0.5),
            X_G2 : Math.floor(X_G2 + 0.5),
            X_L2 : Math.floor(X_L2 + 0.5),
            Y    : Math.floor(Y    + 0.5),
            Y_G  : Math.floor(Y_G  + 0.5),
            Y_L  : Math.floor(Y_L  + 0.5),
            Y_G2 : Math.floor(Y_G2 + 0.5),
            Y_L2 : Math.floor(Y_L2 + 0.5)
        };
    }

    this.m_oImageData.Lines = Lines;

    var dRad = this.m_dKoeffDiam * W / 2;
    var nRad = Math.max(2, Math.ceil(dRad)); // Минимальный радиус пункта должен быть 2 пикселя.
    var Diam = nRad * 2 + 1; // + 1 для нечетности, чтобы точка распологалась по центру линии
    var _x   = nRad;
    var _y   = nRad;

    var HandiColor = this.m_oLinesColor;
    this.m_oImageData.Handi = this.private_DrawHandiMark(_x, _y, nRad, Diam + 2, Diam + 2, HandiColor);
    this.m_oImageData.HandiRad = nRad + 1;
};
CDrawingBoard.prototype.private_DrawTrueColorLines = function(Exclude)
{
    if (!this.m_oImageData.Lines)
        return;

    var W = this.m_oImageData.W;
    var H = this.m_oImageData.H;

    var LinesCanvas = this.HtmlElement.Lines.Control.HtmlElement.getContext("2d");
    var oSize = this.m_oLogicBoard.Get_Size();
    var Lines = this.m_oImageData.Lines;

    // Очищаем канву
    LinesCanvas.clearRect(0, 0, W, H);

    // Рисуем форовые метки
    if (oSize.X === oSize.Y && (9 === oSize.X || 13 === oSize.X || 19 === oSize.X))
    {
        var Handi = this.m_oImageData.Handi;
        var nRad  = this.m_oImageData.HandiRad;

        var aPoints = [];
        switch (oSize.X)
        {
            case 9:  aPoints = [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]]; break;
            case 13: aPoints = [[3, 3], [3, 6], [3, 9], [6, 3], [6, 6], [6, 9], [9, 3], [9, 6], [9, 9]]; break;
            case 19: aPoints = [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]]; break;
        }

        for (var nPointIndex = 0, Count = aPoints.length; nPointIndex < Count; nPointIndex++)
        {
            if (true === this.private_IsPointInViewPort(aPoints[nPointIndex][0], aPoints[nPointIndex][1]))
            {
                var dX = Lines[aPoints[nPointIndex][0]].X - nRad;
                var dY = Lines[aPoints[nPointIndex][1]].Y - nRad;

                LinesCanvas.putImageData(Handi, dX, dY);
            }
        }
    }

    // Рисуем сетку
    var X_0 =           0 === this.m_oViewPort.X0 ? Lines[this.m_oViewPort.X0].X : Lines[this.m_oViewPort.X0].X_L;
    var X_1 = oSize.X - 1 === this.m_oViewPort.X1 ? Lines[this.m_oViewPort.X1].X : Lines[this.m_oViewPort.X1].X_G;

    var Y_0 =           0 === this.m_oViewPort.Y0 ? Lines[this.m_oViewPort.Y0].Y : Lines[this.m_oViewPort.Y0].Y_L;
    var Y_1 = oSize.X - 1 === this.m_oViewPort.Y1 ? Lines[this.m_oViewPort.Y1].Y : Lines[this.m_oViewPort.Y1].Y_G;

    var VerLine = LinesCanvas.createImageData(1, H);
    var HorLine = LinesCanvas.createImageData(W, 1);

    var LineColor = this.m_oLinesColor;
    for (var i = 0; i < H; i++)
    {
        var Index = i * 4;

        if (i >= Y_0 && i <= Y_1)
        {
            VerLine.data[Index + 0] = LineColor.r;
            VerLine.data[Index + 1] = LineColor.g;
            VerLine.data[Index + 2] = LineColor.b;
            VerLine.data[Index + 3] = LineColor.a;
        }
    }

    for (var i = 0; i < W; i++)
    {
        var Index = i * 4;

        if (X_0 <= i && i <= X_1)
        {
            HorLine.data[Index + 0] = LineColor.r;
            HorLine.data[Index + 1] = LineColor.g;
            HorLine.data[Index + 2] = LineColor.b;
            HorLine.data[Index + 3] = LineColor.a;
        }
    }

    for (var i = 0; i < oSize.X; i++)
    {
        if (true === this.private_IsVerLineInViewPort(i))
            LinesCanvas.putImageData(VerLine, Lines[i].X, 0);

        if (true === this.private_IsHorLineInViewPort(i))
            LinesCanvas.putImageData(HorLine, 0, Lines[i].Y);
    }

    // Пересечения на доске, которые мы не отрисовываем из-за текстовых отметок
    if (undefined !== Exclude)
    {
        var clear_w = Lines[1].X - Lines[0].X + 2;
        var clear_h = Lines[1].Y - Lines[0].Y + 2;

        for (var Index = 0, Count = Exclude.length; Index < Count; Index++)
        {
            var X = Exclude[Index].X;
            var Y = Exclude[Index].Y;

            if (true === this.private_IsPointInViewPort(X - 1, Y - 1))
            {
                if (BOARD_EMPTY === this.m_oLogicBoard.Get(X, Y))
                {
                    var _X = Lines[X - 1].X_L2;
                    var _Y = Lines[Y - 1].Y_L2;

                    LinesCanvas.clearRect(_X, _Y, clear_w, clear_h);
                }
            }
        }
    }
};
CDrawingBoard.prototype.private_DrawHandiMark = function(x, y, radius, w, h, Color)
{
    var Canvas = document.createElement("canvas").getContext("2d");
    var ImageData = Canvas.createImageData(w, h);
    var Bitmap = ImageData.data;

    var pixel = 0.8;
    var d = w;
    var d_2 = Math.max(d / 2.0, 2);
    var d2 = d / 2.0 - 5e-1;
    var r = d2 - 2e-1;

    for (var i = 0; i < d; i++)
    {
        for (var j = 0; j < d; j++)
        {
            var di = i - d2;
            var dj = j - d2;
            var hh = r - Math.sqrt(di * di + dj * dj);
            var Index = (i * d + d - j - 1) * 4;
            if (hh >= 0)
            {
                var alpha = 255;

                if (hh <= pixel)
                {
                    var _hh = (pixel - hh) / pixel;
                    alpha = parseInt((1 - _hh) * 255);
                }

                Bitmap[Index + 0] = Color.r;
                Bitmap[Index + 1] = Color.g;
                Bitmap[Index + 2] = Color.b;
                Bitmap[Index + 3] = alpha;
            }
            else
            {
                Bitmap[Index + 0] = 0;
                Bitmap[Index + 1] = 0;
                Bitmap[Index + 2] = 0;
                Bitmap[Index + 3] = 0;
            }
        }
    }

    return ImageData;

    var Canv   = document.createElement("canvas");
    var Canvas = Canv.getContext("2d");

    var ImageData = Canvas.createImageData(w,h);

    var u = radius // ставим минимум 2, чтобы при любом маленьком зуме точки не пропадали
    var v = -1;
    var s = u * u;
    var l = 0.0;

    while ( u > v )
    {
        v++;

        var p  = Math.sqrt(s - v * v);
        var d  = Math.ceil(p) - p;

        if (d <= l)
            u--;

        // Внешняя часть

        var a0 = Math.floor((1.0 - d) * 255);

        var xpu  = x + u;
        var ypu  = y + u;
        var xpv  = x + v;
        var ypv  = y + v;
        var xmu  = x - u;
        var ymu  = y - u;
        var xmv  = x - v;
        var ymv  = y - v;

        this.private_PutPixel(ImageData, xpu , ypv , a0, w, h, Color);
        this.private_PutPixel(ImageData, xpv , ypu , a0, w, h, Color);
        this.private_PutPixel(ImageData, xmu , ypv , a0, w, h, Color);
        this.private_PutPixel(ImageData, xmv , ypu , a0, w, h, Color);
        this.private_PutPixel(ImageData, xpu , ymv , a0, w, h, Color);
        this.private_PutPixel(ImageData, xpv , ymu , a0, w, h, Color);
        this.private_PutPixel(ImageData, xmu , ymv , a0, w, h, Color);
        this.private_PutPixel(ImageData, xmv , ymu , a0, w, h, Color);

        // Внутренняя часть

        var a1 = 255;

        var xpu0 = xpu - 1;
        var ypu0 = ypu - 1;
        var xmu1 = xmu + 1;
        var ymu1 = ymu + 1;

        this.private_PutHorLine(ImageData, xmu1, xpu0, a1, ypv, w, h, Color);
        this.private_PutVerLine(ImageData, ymu1, ypu0, a1, xpv, w, h, Color);
        this.private_PutHorLine(ImageData, xmu1, xpu0, a1, ymv, w, h, Color);
        this.private_PutVerLine(ImageData, ymu1, ypu0, a1, xmv, w, h, Color);

        l = d;
    }

    return ImageData;
};
CDrawingBoard.prototype.private_PutPixel = function(ImageData, x, y, alpha, w, h, Color)
{
    var Index = (x + y * w ) * 4;

    ImageData.data[Index + 0] = Color.r;
    ImageData.data[Index + 1] = Color.g;
    ImageData.data[Index + 2] = Color.b;
    ImageData.data[Index + 3] = alpha;
};
CDrawingBoard.prototype.private_PutHorLine = function(ImageData, x1, x2,alpha, y, w, h, Color)
{
    for (var x = x1; x <= x2; x++)
        this.private_PutPixel(ImageData, x, y, alpha, w, h, Color);
};
CDrawingBoard.prototype.private_PutVerLine = function(ImageData, y1, y2,alpha, x, w, h, Color)
{
    for (var y = y1; y <= y2; y++)
        this.private_PutPixel(ImageData, x, y, alpha, w, h, Color);
};
CDrawingBoard.prototype.private_CreateTrueColorStones = function()
{
    if (!this.m_oImageData.Lines)
        return;

    var W = this.HtmlElement.Board.Control.HtmlElement.width;
    var H = this.HtmlElement.Board.Control.HtmlElement.height;

    var pixel = 0.8, shadow = 0.7;

    var StonesCanvas = this.HtmlElement.Stones.Control.HtmlElement.getContext("2d");

    var DWidth = Math.floor(this.m_dKoeffCellW * W);

    var d = Math.floor(DWidth / 2) * 2 + 1;
    this.m_oImageData.StoneDiam = d;

    this.m_oImageData.BlackStone  = StonesCanvas.createImageData(d, d);
    this.m_oImageData.WhiteStone  = StonesCanvas.createImageData(d, d);
    this.m_oImageData.BlackTarget = StonesCanvas.createImageData(d, d);
    this.m_oImageData.WhiteTarget = StonesCanvas.createImageData(d, d);

    var BlackBitmap = this.m_oImageData.BlackStone.data;
    var WhiteBitmap = this.m_oImageData.WhiteStone.data;
    var BlackTarget = this.m_oImageData.BlackTarget.data;
    var WhiteTarget = this.m_oImageData.WhiteTarget.data;

    if (true === this.m_bTrueColorStones)
    {
        var d2 = d / 2.0 - 5e-1;
        var r = d2 - 2e-1;
        var f = Math.sqrt(3);

        for (var i = 0; i < d; i++)
        {
            for (var j = 0; j < d; j++)
            {
                var di = i - d2;
                var dj = j - d2;
                var hh = r - Math.sqrt(di * di + dj * dj);
                var Index = (i * d + d - j - 1) * 4;
                if (hh >= 0)
                {
                    var z = r * r - di * di - dj * dj;

                    if (z > 0)
                        z = Math.sqrt(z) * f;
                    else
                        z = 0;

                    var x = di;
                    var y = dj;

                    var xr = Math.sqrt(6 * ( x * x + y * y + z * z ));
                    xr = (2 * z - x + y) / xr;

                    var xg = 0;

                    if (xr > 0.9)
                        xg = (xr - 0.9) * 10;

                    var alpha = 255;

                    if (hh <= pixel)
                    {
                        hh = (pixel - hh) / pixel;
                        var shade = shadow;
                        if (di - dj < r / 3)
                            shade = 1;

                        alpha = parseInt((1 - hh * shade ) * 255);
                    }

                    var g = parseInt(10 + 10 * xr + xg * 140);

                    BlackBitmap[Index + 0] = g;
                    BlackBitmap[Index + 1] = g;
                    BlackBitmap[Index + 2] = g;
                    BlackBitmap[Index + 3] = alpha;

                    BlackTarget[Index + 0] = g;
                    BlackTarget[Index + 1] = g;
                    BlackTarget[Index + 2] = g;
                    BlackTarget[Index + 3] = parseInt(alpha / 2);

                    g = parseInt(200 + 10 * xr + xg * 45);

                    WhiteBitmap[Index + 0] = g;
                    WhiteBitmap[Index + 1] = g;
                    WhiteBitmap[Index + 2] = g;
                    WhiteBitmap[Index + 3] = alpha;

                    WhiteTarget[Index + 0] = g;
                    WhiteTarget[Index + 1] = g;
                    WhiteTarget[Index + 2] = g;
                    WhiteTarget[Index + 3] = parseInt(alpha / 2);
                }
                else
                {
                    BlackBitmap[Index + 0] = 0;
                    BlackBitmap[Index + 1] = 0;
                    BlackBitmap[Index + 2] = 0;
                    BlackBitmap[Index + 3] = 0;

                    BlackTarget[Index + 0] = 0;
                    BlackTarget[Index + 1] = 0;
                    BlackTarget[Index + 2] = 0;
                    BlackTarget[Index + 3] = 0;

                    WhiteBitmap[Index + 0] = 0;
                    WhiteBitmap[Index + 1] = 0;
                    WhiteBitmap[Index + 2] = 0;
                    WhiteBitmap[Index + 3] = 0;

                    WhiteTarget[Index + 0] = 0;
                    WhiteTarget[Index + 1] = 0;
                    WhiteTarget[Index + 2] = 0;
                    WhiteTarget[Index + 3] = 0;
                }
            }
        }
    }
    else
    {
        var d2 = d / 2.0 - 5e-1;
        var r = d2 - 2e-1;

        for (var i = 0; i < d; i++)
        {
            for (var j = 0; j < d; j++)
            {
                var di = i - d2;
                var dj = j - d2;
                var hh = r - Math.sqrt(di * di + dj * dj);
                var Index = (i * d + d - j - 1) * 4;
                if (hh >= 0)
                {
                    var alpha = 255;

                    if (hh <= pixel)
                    {
                        var _hh = (pixel - hh) / pixel;
                        var shade = shadow;
                        if (di - dj < r / 3)
                            shade = 1;

                        alpha = parseInt((1 - _hh * shade ) * 255);
                    }
                    else if (hh <= 2 *pixel && hh >= pixel && true === this.m_bDarkBoard)
                    {
                        var _hh = (2 * pixel - hh) / (pixel);
                        var shade = shadow;
                        if (di - dj < r / 3)
                            shade = 1;
                        alpha = parseInt(_hh * shade * 255);
                    }

                    var bBorder = false;
                    if (hh <= 2 *pixel)
                    {
                        bBorder = true;
                    }

                    if (false === bBorder || false === this.m_bDarkBoard)
                    {
                        BlackBitmap[Index + 0] = this.m_oBlackColor.r;
                        BlackBitmap[Index + 1] = this.m_oBlackColor.g;
                        BlackBitmap[Index + 2] = this.m_oBlackColor.b;
                        BlackBitmap[Index + 3] = alpha;

                        BlackTarget[Index + 0] = this.m_oBlackColor.r;
                        BlackTarget[Index + 1] = this.m_oBlackColor.g;
                        BlackTarget[Index + 2] = this.m_oBlackColor.b;
                        BlackTarget[Index + 3] = parseInt(alpha / 2);
                    }
                    else
                    {
                        BlackBitmap[Index + 0] = this.m_oWhiteColor.r;
                        BlackBitmap[Index + 1] = this.m_oWhiteColor.g;
                        BlackBitmap[Index + 2] = this.m_oWhiteColor.b;
                        BlackBitmap[Index + 3] = alpha;

                        BlackTarget[Index + 0] = this.m_oWhiteColor.r;
                        BlackTarget[Index + 1] = this.m_oWhiteColor.g;
                        BlackTarget[Index + 2] = this.m_oWhiteColor.b;
                        BlackTarget[Index + 3] = alpha;
                    }

                    alpha = 255;
                    if (hh <= pixel)
                    {
                        var _hh = (pixel - hh) / pixel;
                        var shade = shadow;
                        if (di - dj < r / 3)
                            shade = 1;

                        alpha = parseInt((1 - _hh * shade ) * 255);
                    }
                    else if (hh <= 2 *pixel && hh >= pixel && false === this.m_bDarkBoard)
                    {
                        var _hh = (2 * pixel - hh) / (pixel);
                        var shade = shadow;
                        if (di - dj < r / 3)
                            shade = 1;
                        alpha = parseInt(_hh * shade * 255);
                    }

                    if (false === bBorder || true === this.m_bDarkBoard)
                    {
                        WhiteBitmap[Index + 0] = this.m_oWhiteColor.r;
                        WhiteBitmap[Index + 1] = this.m_oWhiteColor.g;
                        WhiteBitmap[Index + 2] = this.m_oWhiteColor.b;
                        WhiteBitmap[Index + 3] = alpha;

                        WhiteTarget[Index + 0] = this.m_oWhiteColor.r;
                        WhiteTarget[Index + 1] = this.m_oWhiteColor.g;
                        WhiteTarget[Index + 2] = this.m_oWhiteColor.b;
                        WhiteTarget[Index + 3] = parseInt(alpha / 2);
                    }
                    else
                    {
                        WhiteBitmap[Index + 0] = this.m_oBlackColor.r;
                        WhiteBitmap[Index + 1] = this.m_oBlackColor.g;
                        WhiteBitmap[Index + 2] = this.m_oBlackColor.b;
                        WhiteBitmap[Index + 3] = alpha;

                        WhiteTarget[Index + 0] = this.m_oBlackColor.r;
                        WhiteTarget[Index + 1] = this.m_oBlackColor.g;
                        WhiteTarget[Index + 2] = this.m_oBlackColor.b;
                        WhiteTarget[Index + 3] = alpha;
                    }
                }
                else
                {
                    BlackBitmap[Index + 0] = 0;
                    BlackBitmap[Index + 1] = 0;
                    BlackBitmap[Index + 2] = 0;
                    BlackBitmap[Index + 3] = 0;

                    BlackTarget[Index + 0] = 0;
                    BlackTarget[Index + 1] = 0;
                    BlackTarget[Index + 2] = 0;
                    BlackTarget[Index + 3] = 0;

                    WhiteBitmap[Index + 0] = 0;
                    WhiteBitmap[Index + 1] = 0;
                    WhiteBitmap[Index + 2] = 0;
                    WhiteBitmap[Index + 3] = 0;

                    WhiteTarget[Index + 0] = 0;
                    WhiteTarget[Index + 1] = 0;
                    WhiteTarget[Index + 2] = 0;
                    WhiteTarget[Index + 3] = 0;
                }
            }
        }
    }

    var WhiteStones = new Array();
    var WhiteStones2 = new Array();

    for (var Index = 0; Index < 28; Index++)
    {
        WhiteStones[Index]  = StonesCanvas.createImageData(d, d);
        WhiteStones2[Index] = WhiteStones[Index].data;
        for (var i = 0; i < d; i++)
        {
            for (var j = 0; j < d; j++)
            {
                var CurIndex = (i * d + j) * 4;
                WhiteStones2[Index][CurIndex + 0] = WhiteBitmap[CurIndex + 0];
                WhiteStones2[Index][CurIndex + 1] = WhiteBitmap[CurIndex + 1];
                WhiteStones2[Index][CurIndex + 2] = WhiteBitmap[CurIndex + 2];
                WhiteStones2[Index][CurIndex + 3] = WhiteBitmap[CurIndex + 3];
            }
        }
    }

    WhiteStones2.push(WhiteTarget);
    WhiteStones2.push(WhiteBitmap);

    if (true === this.m_bShellWhiteStones)
        this.private_CreateShellWhiteStones(WhiteStones2, d, d);

    this.m_oImageData.WhiteStones  = WhiteStones;

    var oSize = this.m_oLogicBoard.Get_Size();
    for (var Y = 0; Y < oSize.Y; Y++)
    {
        for (var X = 0; X < oSize.X; X++)
        {
            var Rand = Math.floor(Math.random() * (this.m_oImageData.WhiteStones.length - 1));
            this.m_oImageData.WhiteStones2[X + Y * oSize.X] = Rand;
        }
    }
};
CDrawingBoard.prototype.private_CreateShellWhiteStones = function(ImageDatas, _w, _h)
{
    var w = (_w / 51 * 978) | 0;
    var h = w;

    var f = 9e-1;

    var dCoffWf = new Array( w );

    for ( var j = 0; j < w; j++ )
    {
        dCoffWf[j] =  (Math.sin(18 * j / w) + 1) / 20 + (Math.sin(3 * j / w) + 1) / 10;
    }

    var dCoffHf = new Array( h );
    for ( var i = 0; i < h; i++ )
    {
        dCoffHf[i] = 0.2 * Math.cos( 5 * i / h ) + 0.1 * Math.sin( 11 * i / h );
    }

    var aKoefs = new Array( w * h );

    for (var i = 0; i < h; i++)
    {
        for (var j = 0; j < w; j++)
        {
            f = ( dCoffWf[j] + dCoffHf[i] ) * 90 + 0.5;
            f = f - Math.floor(f);

            if ( f < 2e-1 )
                f = 1 - f / 2;
            else if ( f < 4e-1 )
                f = 1 - ( 4e-1 - f ) / 2;
            else
                f = 1;

            aKoefs[j + i * w] = f;
        }
    }

    var dColorDepth = 0.8;

    var Count = ImageDatas.length;

    for (var Index = 0; Index < Count; Index++)
    {
        var ImageData = ImageDatas[Index];

        var x, y;

        switch (Index)
        {
            case 0 : x = ( 12 * w / 978) | 0; y = (163 * w / 978) | 0; break;
            case 1 : x = ( 12 * w / 978) | 0; y = (213 * w / 978) | 0; break;
            case 2 : x = ( 12 * w / 978) | 0; y = (263 * w / 978) | 0; break;
            case 3 : x = ( 12 * w / 978) | 0; y = (313 * w / 978) | 0; break;
            case 4 : x = ( 62 * w / 978) | 0; y = (163 * w / 978) | 0; break;
            case 5 : x = ( 62 * w / 978) | 0; y = (213 * w / 978) | 0; break;
            case 6 : x = ( 62 * w / 978) | 0; y = (263 * w / 978) | 0; break;
            case 7 : x = ( 62 * w / 978) | 0; y = (313 * w / 978) | 0; break;
            case 8 : x = (113 * w / 978) | 0; y = (163 * w / 978) | 0; break;
            case 9 : x = (113 * w / 978) | 0; y = (213 * w / 978) | 0; break;
            case 10: x = (113 * w / 978) | 0; y = (263 * w / 978) | 0; break;
            case 11: x = (113 * w / 978) | 0; y = (313 * w / 978) | 0; break;
            case 12: x = (163 * w / 978) | 0; y = (163 * w / 978) | 0; break;
            case 13: x = (163 * w / 978) | 0; y = (213 * w / 978) | 0; break;
            case 14: x = (163 * w / 978) | 0; y = (263 * w / 978) | 0; break;
            case 15: x = (163 * w / 978) | 0; y = (313 * w / 978) | 0; break;
            case 16: x = (213 * w / 978) | 0; y = (163 * w / 978) | 0; break;
            case 17: x = (213 * w / 978) | 0; y = (213 * w / 978) | 0; break;
            case 18: x = (213 * w / 978) | 0; y = (263 * w / 978) | 0; break;
            case 19: x = (213 * w / 978) | 0; y = (313 * w / 978) | 0; break;
            case 20: x = (263 * w / 978) | 0; y = (163 * w / 978) | 0; break;
            case 21: x = (263 * w / 978) | 0; y = (213 * w / 978) | 0; break;
            case 22: x = (263 * w / 978) | 0; y = (263 * w / 978) | 0; break;
            case 23: x = (263 * w / 978) | 0; y = (313 * w / 978) | 0; break;
            case 24: x = (313 * w / 978) | 0; y = (163 * w / 978) | 0; break;
            case 25: x = (313 * w / 978) | 0; y = (213 * w / 978) | 0; break;
            case 26: x = (313 * w / 978) | 0; y = (263 * w / 978) | 0; break;
            case 27: x = (313 * w / 978) | 0; y = (313 * w / 978) | 0; break;
            case 28: x = ( 12 * w / 978) | 0; y = ( 12 * w / 978) | 0; break;
            case 29: x = ( 12 * w / 978) | 0; y = ( 12 * w / 978) | 0; break;
        }


        for (var i = 0; i < _h; i++)
        {
            for (var j = 0; j < _w; j++)
            {
                f = aKoefs[x + j + (y + i) * w];

                var ImageDataIndex = (j + i * _w) * 4;
                ImageData[ImageDataIndex + 0] *= Math.pow(f, dColorDepth);
                ImageData[ImageDataIndex + 1] *= Math.pow(f, dColorDepth);
                ImageData[ImageDataIndex + 2] *= Math.pow(f, dColorDepth);
            }
        }
    }
};
CDrawingBoard.prototype.private_RedrawTrueColorAllStones = function()
{
    var W = this.m_oImageData.W;
    var H = this.m_oImageData.H;

    this.HtmlElement.Stones.Control.HtmlElement.getContext("2d").clearRect(0, 0, W, H);
    this.HtmlElement.Shadow.Control.HtmlElement.getContext("2d").clearRect(0, 0, W, H);

    this.m_oBoardPosition = {};

    this.private_DrawTrueColorAllStones();
};
CDrawingBoard.prototype.private_DrawTrueColorAllStones = function()
{
    var oSize = this.m_oLogicBoard.Get_Size();
    for (var Y = 1; Y <= oSize.Y; Y++)
    {
        for (var X = 1; X <= oSize.X; X++)
        {
            this.Draw_Sector(X, Y, this.m_oLogicBoard.Get(X, Y));
        }
    }
};
CDrawingBoard.prototype.private_CreateShadows = function()
{
    if (!this.m_oImageData.Lines)
        return;

    var ShadowCanvas = this.HtmlElement.Shadow.Control.HtmlElement.getContext("2d");
    var d = this.m_oImageData.StoneDiam;
    this.m_oImageData.Shadow = ShadowCanvas.createImageData(d, d);
    var Shadow = this.m_oImageData.Shadow.data;
    this.m_oImageData.ShadowOff = Math.max(parseInt(d * 0.15), 3);

    var r = (d - 5) / 2 + 1;
    for (var i = 0; i < d; i++)
    {
        for (var j = 0; j < d; j++)
        {
            var y = Math.abs(i - r);
            var x = Math.abs(j - r);
            var dist = Math.sqrt(x * x + y * y) / r;

            var f = ( dist < 1.0 ? 0.15 + 0.75 * ( 1 - dist ) : 0 );

            var Index = (d * i + j) * 4;
            Shadow[Index + 0] = 0;
            Shadow[Index + 1] = 0;
            Shadow[Index + 2] = 0;
            Shadow[Index + 3] = parseInt( 255 * f );
        }
    }
};
CDrawingBoard.prototype.private_UpdateTarget = function()
{
    this.private_MoveTarget(this.m_oLastTargetPos.X, this.m_oLastTargetPos.Y, global_mouseEvent, true);
};
CDrawingBoard.prototype.private_MoveTarget = function(X, Y, e, bForce)
{
    if (-1 === X || -1 === Y || 0 === X || 0 === Y)
    {
        this.private_HideTarget();
        return;
    }

    if (null !== this.m_oCreateWoodyId || null === this.m_oImageData.Lines)
        return;

    if (undefined === bForce)
        bForce = false;

    if (X !== this.m_oLastTargetPos.X || Y !== this.m_oLastTargetPos.Y || true === bForce)
    {
        this.m_oLastTargetPos.X = X;
        this.m_oLastTargetPos.Y = Y;

        if (EBoardMode.AddMarkColor === this.m_eMode && this.m_bMouseDown && !bForce)
        {
            this.private_AddColorMark(X, Y, e);
        }

        var W = this.m_oImageData.W;
        var H = this.m_oImageData.H;

        var TargetCanvas = this.HtmlElement.Target.Control.HtmlElement.getContext("2d");
        TargetCanvas.clearRect(0, 0, W, H);

        if (true === this.private_IsPointInViewPort(X - 1, Y - 1))
        {
            var d = this.m_oImageData.StoneDiam;
            var Rad = (d - 1) / 2;
            var Lines = this.m_oImageData.Lines;

            var _X = Lines[X - 1].X - Rad;
            var _Y = Lines[Y - 1].Y - Rad;

            var Value = this.m_oLogicBoard.Get(X, Y);
            switch (this.m_eMode)
            {
                case EBoardMode.Move:
                {
                    if (BOARD_EMPTY === Value)
                    {
                        if (BOARD_BLACK === this.m_oGameTree.Get_NextMove())
                            TargetCanvas.putImageData(this.m_oImageData.BlackTarget, _X, _Y);
                        else
                            TargetCanvas.putImageData(this.m_oImageData.WhiteTarget, _X, _Y);
                    }

                    break;
                }
                case EBoardMode.CountScores:
                {
                    if (BOARD_BLACK === Value)
                        TargetCanvas.putImageData(this.m_oImageData.X_White, _X, _Y);
                    else if (BOARD_WHITE === Value)
                        TargetCanvas.putImageData(this.m_oImageData.X_Black, _X, _Y);

                    break;
                }
                case EBoardMode.AddRemove:
                {
                    if (BOARD_BLACK === Value)
                        TargetCanvas.putImageData(this.m_oImageData.X_White, _X, _Y);
                    else if (BOARD_WHITE === Value)
                        TargetCanvas.putImageData(this.m_oImageData.X_Black, _X, _Y);
                    else
                    {
                        if (e.ShiftKey)
                            TargetCanvas.putImageData(this.m_oImageData.WhiteTarget, _X, _Y);
                        else
                            TargetCanvas.putImageData(this.m_oImageData.BlackTarget, _X, _Y);
                    }

                    break;
                }
                case EBoardMode.ScoreEstimate:
                {
                    var ValueSE = this.m_oLogicBoard.Get_SE(X, Y);
                    if (BOARD_BLACK === ValueSE)
                        TargetCanvas.putImageData(this.m_oImageData.X_White, _X, _Y);
                    else if (BOARD_WHITE === ValueSE)
                        TargetCanvas.putImageData(this.m_oImageData.X_Black, _X, _Y);

                    break;
                }
                case EBoardMode.AddMarkColor:
                {
                    if (global_mouseEvent.CtrlKey && !global_mouseEvent.ShiftKey)
                        TargetCanvas.putImageData(this.m_oImageData.RcolorTarget, _X, _Y);
                    else if (!global_mouseEvent.CtrlKey && global_mouseEvent.ShiftKey)
                        TargetCanvas.putImageData(this.m_oImageData.GcolorTarget, _X, _Y);
                    else if (global_mouseEvent.CtrlKey && global_mouseEvent.ShiftKey)
                        TargetCanvas.putImageData(this.m_oImageData.AcolorTarget, _X, _Y);
                    else
                        TargetCanvas.putImageData(this.m_oImageData.BcolorTarget, _X, _Y);

                    break;
                }
                default:
                {
                    if (BOARD_BLACK === Value || (BOARD_EMPTY === Value && true === this.m_bDarkBoard))
                        TargetCanvas.putImageData(this.m_oImageData.X_White, _X, _Y);
                    else
                        TargetCanvas.putImageData(this.m_oImageData.X_Black, _X, _Y);

                    break;
                }
            }
        }
    }

    // TODO: Обновление статус бара, когда он будет
};
CDrawingBoard.prototype.private_HideTarget = function()
{
    var W = this.m_oImageData.W;
    var H = this.m_oImageData.H;

    var TargetCanvas = this.HtmlElement.Target.Control.HtmlElement.getContext("2d");
    TargetCanvas.clearRect(0, 0, W, H);

    this.m_oLastTargetPos.X = -1;
    this.m_oLastTargetPos.Y = -1;
};
CDrawingBoard.prototype.private_GetBoardPosByXY = function(_X, _Y)
{
    var W = this.m_oImageData.W;
    var H = this.m_oImageData.H;

    var dCellH  = this.m_dKoeffCellH * H;
    var dCellW  = this.m_dKoeffCellW * W;
    var dHorOff = this.m_dKoeffOffsetX * W - dCellH * this.m_oViewPort.X0;
    var dVerOff = this.m_dKoeffOffsetY * H - dCellW * this.m_oViewPort.Y0;

    var Y = 0;

    var oSize = this.m_oLogicBoard.Get_Size();
    for (Y = 0; Y < oSize.Y - 1; Y++)
    {
        if (_Y > dVerOff + dCellH * Y + dCellH / 2)
            continue;
        else
        {
            break;
        }
    }

    var X = 0;
    for (X = 0; X < oSize.X - 1; X++)
    {
        if (_X > dHorOff + dCellW * X + dCellW / 2)
            continue;
        else
        {
            break;
        }
    }

    X = Math.max(this.m_oViewPort.X0, Math.min(this.m_oViewPort.X1, X));
    Y = Math.max(this.m_oViewPort.Y0, Math.min(this.m_oViewPort.Y1, Y));

    return {X : X + 1, Y : Y + 1};
};
CDrawingBoard.prototype.private_CreateMarks = function()
{
    if (!this.m_oImageData.Lines)
        return;

    var d = this.m_oImageData.StoneDiam;
    this.m_oImageData.X_Black   = this.private_DrawX           (d, d, d * 0.05, new CColor(0, 0, 0, 255));
    this.m_oImageData.X_White   = this.private_DrawX           (d, d, d * 0.05, new CColor(255, 255, 255, 255));
    this.m_oImageData.Tr_Black  = this.private_DrawTriangle    (d, d, d * 0.05, new CColor(0, 0, 0, 255));
    this.m_oImageData.Tr_White  = this.private_DrawTriangle    (d, d, d * 0.05, new CColor(255, 255, 255, 255));
    this.m_oImageData.Sq_Black  = this.private_DrawEmptySquare (d, d, d * 0.05, new CColor(0, 0, 0, 255));
    this.m_oImageData.Sq_White  = this.private_DrawEmptySquare (d, d, d * 0.05, new CColor(255, 255, 255, 255));
    this.m_oImageData.Ter_Black = this.private_DrawFilledSquare(d, d, d * 0.05, false, new CColor(  0,   0,   0, 255), this.m_bTrueColorBoard ? new CColor(  0,   0,   0, 255) : this.m_bDarkBoard ? new CColor(255, 255, 255, 255) : new CColor(0, 0, 0, 255));
    this.m_oImageData.Ter_White = this.private_DrawFilledSquare(d, d, d * 0.05, false, new CColor(255, 255, 255, 255), this.m_bTrueColorBoard ? new CColor(255, 255, 255, 255) : this.m_bDarkBoard ? new CColor(255, 255, 255, 255) : new CColor(0, 0, 0, 255));
    this.m_oImageData.Ter_Black2= this.private_DrawFilledSquare(d, d, d * 0.05, true,  new CColor(  0,   0,   0, 255), this.m_bTrueColorBoard ? new CColor(  0,   0,   0, 255) : this.m_bDarkBoard ? new CColor(255, 255, 255, 255) : new CColor(0, 0, 0, 255));
    this.m_oImageData.Ter_White2= this.private_DrawFilledSquare(d, d, d * 0.05, true,  new CColor(255, 255, 255, 255), this.m_bTrueColorBoard ? new CColor(255, 255, 255, 255) : this.m_bDarkBoard ? new CColor(255, 255, 255, 255) : new CColor(0, 0, 0, 255));
    this.m_oImageData.LastMove  = this.private_DrawCircle      (d, d, d * 0.05, new CColor(255, 0, 0, 255));
    this.m_oImageData.Cr_Black  = this.private_DrawCircle      (d, d, d * 0.05, new CColor(0, 0, 0, 255));
    this.m_oImageData.Cr_White  = this.private_DrawCircle      (d, d, d * 0.05, new CColor(255, 255, 255, 255));

    this.m_oImageData.RcolorTarget = this.private_DrawEmptySquare (d, d, d * 0.05, new CColor(200, 0, 0, 255));
    this.m_oImageData.GcolorTarget = this.private_DrawEmptySquare (d, d, d * 0.05, new CColor(0, 128, 0, 255));
    this.m_oImageData.BcolorTarget = this.private_DrawEmptySquare (d, d, d * 0.05, new CColor(0, 0, 200, 255));
    this.m_oImageData.AcolorTarget = this.private_DrawEmptySquare (d, d, d * 0.05, new CColor(128, 128, 128, 255));
};
CDrawingBoard.prototype.private_DrawX = function(W, H, PenWidth, Color)
{
    var MarksCanvas = this.HtmlElement.Marks.Control.HtmlElement.getContext("2d");
    MarksCanvas.clearRect(0, 0, W, H);

    MarksCanvas.strokeStyle = Color.ToString();
    MarksCanvas.fillStyle   = Color.ToString();
    MarksCanvas.lineWidth   = PenWidth;

    MarksCanvas.beginPath();
    MarksCanvas.moveTo(W * 1 / 4, H * 1 / 4);
    MarksCanvas.lineTo(W * 3 / 4, H * 3 / 4);
    MarksCanvas.moveTo(W * 3 / 4, H * 1 / 4);
    MarksCanvas.lineTo(W * 1 / 4, H * 3 / 4);
    MarksCanvas.stroke();

    return MarksCanvas.getImageData(0, 0, W, H);
};
CDrawingBoard.prototype.private_DrawTriangle = function(W, H, PenWidth, Color, Alpha)
{
    if (undefined === Alpha)
        Alpha = 1;

    var MarksCanvas = this.HtmlElement.Marks.Control.HtmlElement.getContext("2d");
    MarksCanvas.clearRect(0, 0, W, H);

    MarksCanvas.globalAlpha = Alpha;
    MarksCanvas.strokeStyle = Color.ToString();
    MarksCanvas.fillStyle   = Color.ToString();
    MarksCanvas.lineWidth   = PenWidth;

    var r     = W / 2;
    var _y    = H * 3 / 4;
    var shift = W * 0.1;

    var _x1 =  Math.sqrt(r * r - (_y - r) * (_y - r)) + r;
    var _x2 = -Math.sqrt(r * r - (_y - r) * (_y - r)) + r;

    MarksCanvas.beginPath();
    MarksCanvas.moveTo(W / 2, shift);
    MarksCanvas.lineTo(_x1 - shift, _y);
    MarksCanvas.lineTo(_x2 + shift, _y);
    MarksCanvas.closePath();
    MarksCanvas.stroke();

    return MarksCanvas.getImageData(0, 0, W, H);
};
CDrawingBoard.prototype.private_DrawEmptySquare = function(W, H, PenWidth, Color)
{
    var MarksCanvas = this.HtmlElement.Marks.Control.HtmlElement.getContext("2d");
    MarksCanvas.clearRect(0, 0, W, H);

    MarksCanvas.strokeStyle = Color.ToString();
    MarksCanvas.fillStyle   = Color.ToString();
    MarksCanvas.lineWidth   = Math.floor(PenWidth + 0.5);

    var r     = W / 2;
    var shift = PenWidth;

    var _y1  = -H / 2 * Math.sqrt(2) / 2 + H / 2;
    var _y2  =  H / 2 * Math.sqrt(2) / 2 + H / 2;

    var _x1 = -Math.sqrt(r * r - (_y1 - r) * (_y1 - r)) + r;
    var _x2 = +Math.sqrt(r * r - (_y1 - r) * (_y1 - r)) + r;

    var x1 = Math.floor(_x1);
    var x2 = Math.ceil(_x2);
    var y1 = Math.ceil(_y1);
    var y2 = Math.floor(_y2);
    var width = Math.floor(PenWidth);

    var ImageData = MarksCanvas.createImageData(W, H);
    for (var i = 0; i < H; i++)
    {
        for (var j = 0; j < W; j++)
        {
            var Index = (i * W + j) * 4;

            if ( (((x1 <= j && j <= x1 + width) || (x2 - width <= j && j <= x2)) && y1 <= i && i <= y2) ||
                 (((y1 <= i && i <= y1 + width) || (y2 - width <= i && i <= y2)) && x1 <= j && j <= x2) )
            {
                ImageData.data[Index + 0] = Color.r;
                ImageData.data[Index + 1] = Color.g;
                ImageData.data[Index + 2] = Color.b;
                ImageData.data[Index + 3] = 255;
            }
            else
            {
                ImageData.data[Index + 0] = 0;
                ImageData.data[Index + 1] = 0;
                ImageData.data[Index + 2] = 0;
                ImageData.data[Index + 3] = 0;
            }
        }
    }


    return ImageData;
};
CDrawingBoard.prototype.private_DrawFilledSquare = function(W, H, PenWidth, bBig, Color, BorderColor)
{
    var MarksCanvas = this.HtmlElement.Marks.Control.HtmlElement.getContext("2d");

    var ImageData = MarksCanvas.createImageData(W, H);

    var H_3   = bBig ? H / 4     | 0 : H / 3     | 0;
    var H_2_3 = bBig ? H * 3 / 4 | 0 : H * 2 / 3 | 0;
    var W_3   = bBig ? W / 4     | 0 : W / 3     | 0;
    var W_2_3 = bBig ? W * 3 / 4 | 0 : W * 2 / 3 | 0;

    for (var i = 0; i < H; i++)
    {
        for (var j = 0; j < W; j++)
        {
            var Index = (i * W + j) * 4;

            if (((i === H_3 || i === H_2_3) && j >= W_3 && j <= W_2_3) || ((j === W_3 || j === W_2_3) && i >= H_3 && i <= H_2_3))
            {
                ImageData.data[Index + 0] = BorderColor.r;
                ImageData.data[Index + 1] = BorderColor.g;
                ImageData.data[Index + 2] = BorderColor.b;
                ImageData.data[Index + 3] = 255;
            }
            else if (i > H_3 && i < H_2_3 && j > W_3 && j < W_2_3)
            {
                ImageData.data[Index + 0] = Color.r;
                ImageData.data[Index + 1] = Color.g;
                ImageData.data[Index + 2] = Color.b;
                ImageData.data[Index + 3] = 255;
            }            else
                ImageData.data[Index + 3] = 0;
        }
    }

    return ImageData;
};
CDrawingBoard.prototype.private_DrawCircle = function(W, H, PenWidth, Color)
{
    var MarksCanvas = this.HtmlElement.Marks.Control.HtmlElement.getContext("2d");
    MarksCanvas.clearRect(0, 0, W, H);

    var r     = W / 2;
    var shift = PenWidth * 4;

    MarksCanvas.strokeStyle = Color.ToString();
    MarksCanvas.fillStyle   = Color.ToString();
    MarksCanvas.lineWidth   = PenWidth;
    MarksCanvas.beginPath();
    MarksCanvas.arc(W / 2, H / 2, r - shift, 0, 2 * Math.PI, false);
    MarksCanvas.stroke();

    return MarksCanvas.getImageData(0, 0, W, H);
};
CDrawingBoard.prototype.private_DrawRulers = function()
{
    if (true === this.m_bRulers && this.m_oImageData.Lines)
    {
        var BoardCanvas = this.HtmlElement.Board.Control.HtmlElement.getContext("2d");
        var W = this.m_oImageData.W;
        var H = this.m_oImageData.H;
        var oSize = this.m_oLogicBoard.Get_Size();
        for (var X = this.m_oViewPort.X0; X <= this.m_oViewPort.X1; X++)
        {
            var d = 2 * this.m_oImageData.StoneDiam / 3;
            var Rad = (d - 1) / 2;
            var Lines = this.m_oImageData.Lines;
            var _X = Lines[X].X - Rad;
            var _Y = this.m_dKoeffOffsetY * H / 3 - Rad;

            var Text = Common_X_to_String(X + 1);
            var FontSize = 2 * d / 3;
            var FontFamily = (Common_IsInt(Text) ? "Arial" : "Helvetica, Arial, Verdana");
            var sFont = FontSize + "px " + FontFamily;

            BoardCanvas.fillStyle = "rgb(0,0,0)";
            BoardCanvas.font = sFont;

            var y_offset = d / 2 + FontSize / 3;
            var x_offset = (d - BoardCanvas.measureText(Text).width) / 2;

            BoardCanvas.fillText(Text, _X + x_offset, _Y + y_offset);

            _Y = H - this.m_dKoeffOffsetY * H / 3 - Rad;
            BoardCanvas.fillText(Text, _X + x_offset, _Y + y_offset);
        }

        for (var Y = this.m_oViewPort.Y0; Y <= this.m_oViewPort.Y1; Y++)
        {
            var d     = 2 * this.m_oImageData.StoneDiam / 3;
            var Rad   = (d - 1) / 2;
            var Lines = this.m_oImageData.Lines;
            var _X    = this.m_dKoeffOffsetX * W / 3 - Rad;
            var _Y    = Lines[Y].Y - Rad;

            var Text       = (oSize.Y - Y) + "";
            var FontSize   =  2 * d / 3;
            var FontFamily = (Common_IsInt(Text) ? "Arial" : "Helvetica, Arial, Verdana");
            var sFont     = FontSize + "px " + FontFamily;

            BoardCanvas.fillStyle = "rgb(0,0,0)";
            BoardCanvas.font      = sFont;

            var y_offset = d / 2 + FontSize / 3;
            var x_offset = (d - BoardCanvas.measureText(Text).width) / 2;

            BoardCanvas.fillText(Text, _X + x_offset, _Y + y_offset);

            _X = W - this.m_dKoeffOffsetX * W / 3 - Rad;
            BoardCanvas.fillText(Text, _X + x_offset, _Y + y_offset);
        }
    }
};
CDrawingBoard.prototype.private_GetMark = function(X, Y)
{
    var Mark = this.m_oMarks["" + Common_XYtoValue(X, Y)];

    if (undefined !== Mark)
        return Mark;

    return null;
};
CDrawingBoard.prototype.private_SetMark = function(X, Y, Mark)
{
    if (EDrawingMark.Lm === Mark.Get_Type())
        this.private_SetLastMoveMark(X, Y);
    else
        this.m_oMarks["" + Common_XYtoValue(X, Y)] = Mark;
};
CDrawingBoard.prototype.private_SetLastMoveMark = function(X, Y)
{
    if (X <= 0 || Y <= 0)
    {
        this.m_oLastMoveMark = 0;
        return;
    }

    var Place = Common_XYtoValue(X, Y);
    if (undefined === this.m_oMarks["" + Place])
        this.m_oMarks["" + Place] = new CDrawingMark(X, Y, EDrawingMark.Lm, "");

    this.m_oLastMoveMark = Place;
};
CDrawingBoard.prototype.private_DrawMarks = function()
{
    var MarksCanvas = this.HtmlElement.Marks.Control.HtmlElement.getContext("2d");
    var W           = this.m_oImageData.W;
    var H           = this.m_oImageData.H;

    MarksCanvas.clearRect(0, 0, W, H);

    var Exclude = new Array();
    for (var Pos in this.m_oMarks)
    {
        var Mark = this.m_oMarks[Pos];
        this.private_DrawMark(Mark);

        if (EDrawingMark.Tx === Mark.Get_Type())
            Exclude.push({X : Mark.Get_X(), Y : Mark.Get_Y()});
    }

    this.private_DrawTrueColorLines(Exclude);
};
CDrawingBoard.prototype.private_DrawMark = function(Mark)
{
    if (!this.m_oImageData.Lines)
        return;

    var X     = Mark.Get_X();
    var Y     = Mark.Get_Y();
    var nType = Mark.Get_Type();

    var MarksCanvas = this.HtmlElement.Marks.Control.HtmlElement.getContext("2d");

    if (true === this.private_IsPointInViewPort(X - 1, Y - 1))
    {
        var d = this.m_oImageData.StoneDiam;
        var Rad = (d - 1) / 2;
        var Lines = this.m_oImageData.Lines;
        var _X = Lines[X - 1].X - Rad;
        var _Y = Lines[Y - 1].Y - Rad;

        var Value = this.m_oLogicBoard.Get(X, Y);

        switch (nType)
        {
            case EDrawingMark.Tb:
                MarksCanvas.putImageData(this.m_oImageData.Ter_Black, _X, _Y);
                break;
            case EDrawingMark.Tw:
                MarksCanvas.putImageData(this.m_oImageData.Ter_White, _X, _Y);
                break;
            case EDrawingMark.Tb2:
                MarksCanvas.putImageData(this.m_oImageData.Ter_Black2, _X, _Y);
                break;
            case EDrawingMark.Tw2:
                MarksCanvas.putImageData(this.m_oImageData.Ter_White2, _X, _Y);
                break;
            case EDrawingMark.Lm:
                MarksCanvas.putImageData(this.m_oImageData.LastMove, _X, _Y);
                break;
            case EDrawingMark.Cr:
                MarksCanvas.putImageData(Value === BOARD_BLACK || (Value == BOARD_EMPTY && true == this.m_bDarkBoard) ? this.m_oImageData.Cr_White : this.m_oImageData.Cr_Black, _X, _Y);
                break;
            case EDrawingMark.Sq:
                MarksCanvas.putImageData(Value === BOARD_BLACK || (Value == BOARD_EMPTY && true == this.m_bDarkBoard) ? this.m_oImageData.Sq_White : this.m_oImageData.Sq_Black, _X, _Y);
                break;
            case EDrawingMark.Tr:
                MarksCanvas.putImageData(Value === BOARD_BLACK || (Value == BOARD_EMPTY && true == this.m_bDarkBoard) ? this.m_oImageData.Tr_White : this.m_oImageData.Tr_Black, _X, _Y);
                break;
            case EDrawingMark.X :
                MarksCanvas.putImageData(Value === BOARD_BLACK || (Value == BOARD_EMPTY && true == this.m_bDarkBoard) ? this.m_oImageData.X_White : this.m_oImageData.X_Black, _X, _Y);
                break;
            case EDrawingMark.Tx:
            {
                var Text = Mark.Get_Text();
                var FontSize = (Text.length <= 2 ? 2 * d / 3 : d / 2);
                var FontFamily = (Common_IsInt(Text) ? "Arial" : "Helvetica, Arial, Verdana");
                var sFont = FontSize + "px " + FontFamily;

                MarksCanvas.fillStyle = Value === BOARD_BLACK || (Value == BOARD_EMPTY && true == this.m_bDarkBoard) ? "rgb(255,255,255)" : "rgb(0,0,0)";
                MarksCanvas.font = sFont;

                var y_offset = d / 2 + FontSize / 3;
                var x_offset = (d - MarksCanvas.measureText(Text).width) / 2;

                MarksCanvas.fillText(Text, _X + x_offset, _Y + y_offset);

                break;
            }
        }
    }
};
CDrawingBoard.prototype.private_ClearMark = function(X, Y)
{
    if (!this.m_oImageData.Lines)
        return;

    if (true === this.private_IsPointInViewPort(X - 1, Y - 1))
    {
        var d = this.m_oImageData.StoneDiam;
        var Rad = (d - 1) / 2;
        var Lines = this.m_oImageData.Lines;
        var _X = Lines[X - 1].X - Rad;
        var _Y = Lines[Y - 1].Y - Rad;

        var MarksCanvas = this.HtmlElement.Marks.Control.HtmlElement.getContext("2d");
        MarksCanvas.clearRect(_X, _Y, Rad * 2, Rad * 2);

        var LastMoveMarkPos = Common_ValuetoXY(this.m_oLastMoveMark);
        if (X === LastMoveMarkPos.X && Y === LastMoveMarkPos.Y)
        {
            this.private_SetLastMoveMark(X, Y);
            this.private_DrawMark(this.private_GetMark(X, Y));
        }
    }
};
CDrawingBoard.prototype.private_DrawAllColorMarks = function()
{
    for (var nPosValue in this.m_oColorMarks)
    {
        var oPos = Common_ValuetoXY(nPosValue);
        this.private_DrawColorMark(oPos.X, oPos.Y);
    }
};
CDrawingBoard.prototype.private_ClearAllColorMarks = function()
{
    var Canvas = this.HtmlElement.Colors.Control.HtmlElement.getContext("2d");
    Canvas.clearRect(0, 0, this.m_oImageData.W, this.m_oImageData.H);

    this.m_oColorMarks = {};
};
CDrawingBoard.prototype.private_AddColorMark = function(X, Y, e)
{
    var nPosValue = Common_XYtoValue(X, Y);

    if (g_mouse_button_right === e.Button)
    {
        if (undefined !== this.m_oColorMarks[nPosValue])
        {
            delete this.m_oColorMarks[nPosValue];
            this.private_ClearColorMark(X, Y);
        }
    }
    else
    {
        var Color;
        if (e.CtrlKey && !e.ShiftKey)
            Color = new CColor(200, 0, 0, 60);
        else if (e.ShiftKey && !e.CtrlKey)
            Color = new CColor(0, 100, 0, 60);
        else if (e.ShiftKey && e.CtrlKey)
            Color = new CColor(80, 80, 80, 60);
        else
            Color = new CColor(0, 0, 200, 60);

        if (undefined !== this.m_oColorMarks[nPosValue])
        {
            var PrevColor = this.m_oColorMarks[nPosValue];
            if (Color.r === PrevColor.r && Color.g === PrevColor.g && Color.b === PrevColor.b)
            {

                var a = PrevColor.a;
                if (a < 60)
                    a = 60;
                else if (a < 120)
                    a = 120;
                else
                    a = 180;

                this.m_oColorMarks[nPosValue].a = a;
            }
            else
                this.m_oColorMarks[nPosValue] = Color;
        }
        else
            this.m_oColorMarks[nPosValue] = Color;

        this.private_DrawColorMark(X, Y);
    }
};
CDrawingBoard.prototype.private_DrawColorMark = function(_X, _Y)
{
    this.private_ClearColorMark(_X, _Y);

    var Canvas = this.HtmlElement.Colors.Control.HtmlElement.getContext("2d");

    var Lines = this.m_oImageData.Lines;

    var X = _X - 1;
    var Y = _Y - 1;

    Canvas.fillStyle = this.m_oColorMarks[Common_XYtoValue(_X, _Y)].ToString();
    Canvas.beginPath();
    Canvas.moveTo(Lines[X].X_L2, Lines[Y].Y_L2);
    Canvas.lineTo(Lines[X].X_G2, Lines[Y].Y_L2);
    Canvas.lineTo(Lines[X].X_G2, Lines[Y].Y_G2);
    Canvas.lineTo(Lines[X].X_L2, Lines[Y].Y_G2);
    Canvas.closePath();
    Canvas.fill();
};
CDrawingBoard.prototype.private_ClearColorMark = function(_X, _Y)
{
    var Canvas = this.HtmlElement.Colors.Control.HtmlElement.getContext("2d");

    var Lines = this.m_oImageData.Lines;

    var X = _X - 1;
    var Y = _Y - 1;

    Canvas.clearRect(Lines[X].X_L2, Lines[Y].Y_L2, Lines[X].X_G2 - Lines[X].X_L2, Lines[Y].Y_G2 - Lines[Y].Y_L2);
};
CDrawingBoard.prototype.private_HandleMouseDown = function(X, Y, event)
{
    switch(this.m_eMode)
    {
        case EBoardMode.Move         : this.private_AddMove          (X,Y, event); break;
        case EBoardMode.CountScores  : this.private_CountScores      (X,Y, event); break;
        case EBoardMode.AddRemove    : this.private_AddOrRemoveStones(X,Y, event); break;
        case EBoardMode.AddMarkTr    : this.private_AddTriangle      (X,Y, event); break;
        case EBoardMode.AddMarkSq    : this.private_AddSquare        (X,Y, event); break;
        case EBoardMode.AddMarkCr    : this.private_AddCircle        (X,Y, event); break;
        case EBoardMode.AddMarkX     : this.private_AddX             (X,Y, event); break;
        case EBoardMode.AddMarkTx    : this.private_AddText          (X,Y, event); break;
        case EBoardMode.AddMarkNum   : this.private_AddNum           (X,Y, event); break;
        case EBoardMode.ScoreEstimate: this.private_ScoreEstimate    (X,Y, event); break;
        case EBoardMode.AddMarkColor : this.private_AddColorMark     (X,Y, event); break;
    }
};
CDrawingBoard.prototype.private_AddMove = function(X, Y, event)
{
    if (g_mouse_button_right == event.Button)
    {
        // По правой кнопки мыши создаем вариант текущего хода.
        if (this.m_oGameTree.Get_CurNodeDepth() >= 1)
        {
            this.m_oGameTree.Step_Backward(1);
            this.private_MakeMove(X, Y);
        }
    }
    else if (event.ShiftKey && event.CtrlKey)
    {
        // Меняем текущий ход.
        var NextMove = BOARD_BLACK === this.m_oGameTree.Get_NextMove() ? BOARD_WHITE : BOARD_BLACK;
        this.m_oGameTree.Set_NextMove( NextMove );
        this.private_UpdateTarget();
    }
    else if (true === event.CtrlKey)
    {
        // Добавляем комментарий с позицией хода.
        var sComment = Common_XYtoString(X, Y);
        this.m_oGameTree.Add_Comment(sComment);
    }
    else if (event.ShiftKey)
    {
        // С зажатой клавишей Shift мы перемещаемся к ходу в заданной позиции в текущем варианте.
        this.m_oGameTree.GoTo_NodeByXY(X, Y);
    }
    else
    {
        this.private_MakeMove(X, Y);

        if (null !== this.m_oPresentation)
        {
            if (this.m_oGameTree.Get_CurNode().Count_NodeNumber() >= this.m_oPresentation.Get_NodesCountInSlide())
                this.m_oPresentation.On_EndSgfSlide();
        }
    }
};
CDrawingBoard.prototype.private_CountScores = function(X, Y, event)
{
    if (true === event.CtrlKey )
    {
        // Возвращаемся к режиму добавления ходов
        this.Set_Mode(EBoardMode.Move);
    }
    else
    {
        this.m_oLogicBoard.Select_DeadGroup(X, Y);
        this.m_oGameTree.Count_Scores();
    }
};
CDrawingBoard.prototype.private_AddOrRemoveStones = function(X, Y, event)
{
    // Если в данной ноде есть ход, тогда мы добавляем новую ноду, если нет,
    // тогда добавляем изменения в текущую ноду.

    if (true === this.m_oGameTree.Get_CurNode().Have_Move())
    {
        // Добавляем новую ноду
        if (true === this.m_oGameTree.Add_NewNode(true, true))
            this.m_oGameTree.Execute_CurNodeCommands();
    }

    var Value = BOARD_BLACK;
    if (BOARD_EMPTY !== this.m_oLogicBoard.Get(X, Y))
        Value = BOARD_EMPTY;
    else if (event.ShiftKey)
        Value = BOARD_WHITE;

    this.Draw_Sector(X, Y, Value);
    this.m_oLogicBoard.Set(X, Y, Value, -1);
    this.m_oGameTree.AddOrRemove_Stones(Value, [Common_XYtoValue(X, Y)]);
};
CDrawingBoard.prototype.private_AddMark = function(Type, X, Y)
{
    var Mark = this.private_GetMark(X, Y);

    if (null !== Mark && Type === Mark.Get_Type())
    {
        this.m_oGameTree.Remove_Mark([Common_XYtoValue(X, Y)]);
        this.Remove_Mark(X, Y);
        this.private_ClearMark(X, Y);
    }
    else
    {
        var NewMark = new CDrawingMark(X, Y, Type, "");
        this.m_oGameTree.Add_Mark(Type, [Common_XYtoValue(X, Y)]);
        this.private_SetMark(X, Y, NewMark);
        this.private_DrawMark(NewMark);
    }
};
CDrawingBoard.prototype.private_AddTriangle = function(X, Y, event)
{
    this.private_AddMark(EDrawingMark.Tr, X, Y);
};
CDrawingBoard.prototype.private_AddSquare = function(X, Y, event)
{
    this.private_AddMark(EDrawingMark.Sq, X, Y);
};
CDrawingBoard.prototype.private_AddCircle = function(X, Y, event)
{
    this.private_AddMark(EDrawingMark.Cr, X, Y);
};
CDrawingBoard.prototype.private_AddX = function(X, Y, event)
{
    this.private_AddMark(EDrawingMark.X, X, Y);
};
CDrawingBoard.prototype.private_AddText = function(X, Y, event)
{
    var Mark = this.private_GetMark(X, Y);

    if (null !== Mark && EDrawingMark.Tx === Mark.Get_Type())
    {
        this.m_oGameTree.Remove_Mark([Common_XYtoValue(X, Y)]);
        this.Remove_Mark(X, Y);
    }
    else
    {
        var sText = "";
        if (event.ShiftKey)
            sText = prompt("Enter the label that you want to add to board here. For best results, keep your label to one or two letters.", "");

        if (undefined == sText || "" === sText || null === sText)
        {
            sText = this.private_GetNextTextMark();
            if (null === sText)
            {
                alert("Sorry, all the standard labels are used up! To add more labels, you will have to shift click on the board and make up ur own labels to add.");
                return;
            }
        }

        var NewMark = new CDrawingMark(X, Y, EDrawingMark.Tx, sText);
        this.m_oGameTree.Add_TextMark(sText, Common_XYtoValue(X, Y));
        this.private_SetMark(X, Y, NewMark);
    }

    // TODO: Приходится вызывать полную перерисовку всех отметок из-за сетки.
    this.private_DrawMarks();
};
CDrawingBoard.prototype.private_AddNum = function(X, Y, event)
{
    var Mark = this.private_GetMark(X, Y);

    if (null !== Mark && EDrawingMark.Tx === Mark.Get_Type())
    {
        this.m_oGameTree.Remove_Mark([Common_XYtoValue(X, Y)]);
        this.Remove_Mark(X, Y);
    }
    else
    {
        var sText = "";
        if (event.ShiftKey)
        {
            var MoveNum = this.m_oLogicBoard.Get_Num(X, Y);
            if (-1 == MoveNum)
            {
                return alert("Sorry, no move has been made at that location, so you can't mark it with the move number!");

                CreateWindow("tesetste", EWindowType.Error, {ErrorText : "Sorry, no move has been made at that location, so you can't mark it with the move number!"});
                return;
            }
            else
                sText = "" + MoveNum;
        }

        if (undefined === sText || "" === sText || null === sText)
            sText = this.private_GetNextNumMark();

        var NewMark = new CDrawingMark(X, Y, EDrawingMark.Tx, sText);
        this.m_oGameTree.Add_TextMark(sText, Common_XYtoValue(X, Y));
        this.private_SetMark(X, Y, NewMark);
    }

    // TODO: Приходится вызывать полную перерисовку всех отметок из-за сетки.
    this.private_DrawMarks();
};
CDrawingBoard.prototype.private_GetNextTextMark = function()
{
    var arrLabels = [];
    var Num = -1;

    for(var Pos in this.m_oMarks)
    {
        var Mark = this.m_oMarks[Pos];
        if (EDrawingMark.Tx == Mark.Get_Type())
        {
            var sCur = Mark.Get_Text();
            var Char = sCur.charCodeAt(0);

            if ( 1 == sCur.length && 65 <= Char && Char <= 90 )
            {
                arrLabels[Char] = 1;
            }
        }
    }

    for (var Index = 65; Index <= 90; Index++)
    {
        if (undefined === arrLabels[Index] || "" == arrLabels[Index])
        {
            Num = Index;
            break;
        }
    }

    if (-1 == Num)
        return null;
    else
        return String.fromCharCode(Num);
};
CDrawingBoard.prototype.private_GetNextNumMark = function()
{
    var arrLabels = [];
    var arrayLen = 0;
    for(var Pos in this.m_oMarks)
    {
        var Mark = this.m_oMarks[Pos];
        if (EDrawingMark.Tx === Mark.Get_Type())
        {
            if (Common_IsInt(Mark.Get_Text()))
            {
                arrLabels[arrayLen] = parseInt(Mark.Get_Text());
                arrayLen++;
            }
        }
    }

    if (arrayLen <= 0)
        return "1";

    // Сортируем по возрастанию
    arrLabels.sort(Common_SortIncrease);
    var PrevValue = 0;
    var nResult = 0;
    var bFind = false;
    for (var Index = 0; Index < arrayLen; Index++)
    {
        if (arrLabels[Index] > PrevValue + 1)
        {
            nResult = (PrevValue + 1);
            bFind = true;
            break;
        }
        PrevValue = arrLabels[Index];
    }

    if (!bFind)
        nResult = PrevValue + 1;

    return "" + nResult;
};
CDrawingBoard.prototype.private_MakeMove = function(X, Y)
{
    if (BOARD_EMPTY === this.m_oLogicBoard.Get(X, Y))
    {
        var Value = (BOARD_BLACK === this.m_oGameTree.Get_NextMove() ? BOARD_BLACK : BOARD_WHITE);

        // Сначала мы проверим, можно ли совершить данный ход
        var bMove = false;

        var OldKo = this.m_oLogicBoard.Get_Ko();
        this.m_oLogicBoard.Set(X, Y, Value, -1);

        // Проверяем ко
        if (null !== this.m_oLogicBoard.Check_Kill(X, Y, Value, true))
            bMove = true;
        // Запрещаем самоубийство
        else if (null !== this.m_oLogicBoard.Check_Dead(X, Y, Value))
            bMove = false;
        else
            bMove = true;

        // Восстанвливаем позицию на доске.
        this.m_oLogicBoard.Set(X, Y, BOARD_EMPTY, -1);
        this.m_oLogicBoard.Set_Ko(OldKo);

        if (true == bMove)
        {
            if (true === this.m_oGameTree.Add_NewNodeByPos(X, Y, Value))
                this.m_oGameTree.Execute_CurNodeCommands();
        }
    }
};
CDrawingBoard.prototype.private_ScoreEstimate = function(X, Y, event)
{
    this.m_oLogicBoard.Mark_DeadGroupForEstimate(X, Y);
    var oResult = this.m_oLogicBoard.Estimate_Scores(this);
    if (this.m_oEstimateEventsCatcher)
        this.m_oEstimateEventsCatcher.On_EstimateEnd(oResult.BlackReal, oResult.WhiteReal, oResult.BlackPotential, oResult.WhitePotential);
    this.Draw_Marks();
    this.private_UpdateTarget();
};
CDrawingBoard.prototype.private_HandleKeyDown = function(Event)
{
    if (EBoardMode.ScoreEstimate === this.m_eMode)
        return;

    var KeyCode = Event.KeyCode;

    if (8 === KeyCode || 46 === KeyCode) // backspace/delete
    {
        this.m_oGameTree.Remove_CurNode();
    }
    else if (13 === KeyCode) // Enter
    {
        var sSgfFile = prompt("Enter here code of ur sgf file", "");
        this.m_oGameTree.Load_Sgf(sSgfFile);
    }
    else if (37 === KeyCode) // Left Arrow
    {
        if (Event.CtrlKey && Event.ShiftKey)
            this.m_oGameTree.Step_BackwardToStart();
        else if (Event.CtrlKey)
            this.m_oGameTree.Step_Backward(5);
        else
            this.m_oGameTree.Step_Backward(1);
    }
    else if (38 === KeyCode) // Up Arrow
    {
        if (Event.CtrlKey)
            this.m_oGameTree.GoTo_MainVariant();
        else
            this.m_oGameTree.GoTo_PrevVariant();
    }
    else if (39 === KeyCode) // Right Arrow
    {
        if (Event.CtrlKey && Event.ShiftKey)
            this.m_oGameTree.Step_ForwardToEnd();
        else if (Event.CtrlKey)
            this.m_oGameTree.Step_Forward(5);
        else
            this.m_oGameTree.Step_Forward(1);
    }
    else if (40 === KeyCode ) // Down Arrow
    {
        this.m_oGameTree.GoTo_NextVariant();
    }
    else if (69 === KeyCode && true === Event.CtrlKey) // Ctrl + E
    {
        CreateWindow(this.HtmlElement.Control.HtmlElement.id, EWindowType.ScoreEstimate, {GameTree : this.m_oGameTree});
    }
    else if (72 === KeyCode && true === Event.CtrlKey) // Ctrl + H
    {
        this.m_oGameTree.Download_BoardScreenShot();
    }
    else if (79 === KeyCode && true === Event.CtrlKey && EBoardMode.AddMarkColor === this.m_eMode) // Ctrl + O
    {
        CreateWindow(this.HtmlElement.Control.HtmlElement.id, EWindowType.CountColors, {DrawingBoard : this});
    }
    else if (82 === KeyCode && true === Event.CtrlKey && EBoardMode.AddMarkColor === this.m_eMode) // Ctrl + R
    {
        this.private_ClearAllColorMarks();
    }
    else if (83 === KeyCode && true === Event.CtrlKey) // Ctrl + S
    {
        var sSgf = this.m_oGameTree.Save_Sgf();

        if (FileReader && Blob)
        {
            var sGameName = this.m_oGameTree.Get_GameName();
            if ("" === sGameName)
                sGameName = this.m_oGameTree.Get_WhiteName() + " vs. " + this.m_oGameTree.Get_BlackName();
            if ("" === sGameName)
                sGameName = "download";

            sGameName += ".sgf";

            var oFileReader = new FileReader();
            oFileReader['readAsDataURL'](new Blob([sSgf], {type: "text/plain;charset=utf-8"}));
            oFileReader['onload'] = function (event)
            {
                var oSaveElement         = document.createElement('a');
                oSaveElement['href']     = event.target.result;
                oSaveElement['target']   = '_blank';
                oSaveElement['download'] = sGameName || 'unknown file';

                var oEvent = document.createEvent('Event');
                oEvent.initEvent('click', true, true);
                oSaveElement.dispatchEvent(oEvent);
                (window['URL'] || window['webkitURL']).revokeObjectURL(oSaveElement['href']);
            };
        }
    }
    else if (112 === KeyCode) // F1
    {
        this.Set_Mode(EBoardMode.Move);
    }
    else if (113 === KeyCode) // F2
    {
        this.Set_Mode(EBoardMode.CountScores);
    }
    else if (114 === KeyCode) // F3
    {
        this.Set_Mode(EBoardMode.AddRemove);
    }
    else if (115 === KeyCode) // F4
    {
        this.Set_Mode(EBoardMode.AddMarkTr);
    }
    else if (116 === KeyCode) // F5
    {
        this.Set_Mode(EBoardMode.AddMarkSq);
    }
    else if (117 === KeyCode) // F6
    {
        this.Set_Mode(EBoardMode.AddMarkCr);
    }
    else if (118 === KeyCode) // F7
    {
        this.Set_Mode(EBoardMode.AddMarkX);
    }
    else if (119 === KeyCode) // F8
    {
        this.Set_Mode(EBoardMode.AddMarkTx);
    }
    else if (120 === KeyCode) // F9
    {
        this.Set_Mode(EBoardMode.AddMarkNum);
    }
    else if (121 === KeyCode) // F10
    {
        this.Set_Mode(EBoardMode.AddMarkColor);
    }
    else if (189 === KeyCode) // -
    {
        var eType = this.m_oGameTree.Get_ShowVariants();

        eType++;
        if (eType > EShowVariants.Max)
            eType = EShowVariants.Min;

        this.m_oGameTree.Set_ShowVariants(eType);
    }
    else if (192 === KeyCode) // ~ (Ё)
    {
        this.Set_Rulers(true === this.m_bRulers ? false : true);
    }
};
CDrawingBoard.prototype.private_IsPointInViewPort = function(X, Y)
{
    if (X >= this.m_oViewPort.X0 && X <= this.m_oViewPort.X1 && Y >= this.m_oViewPort.Y0 && Y <= this.m_oViewPort.Y1)
        return true;

    return false;
};
CDrawingBoard.prototype.private_IsHorLineInViewPort = function(Y)
{
    if (Y >= this.m_oViewPort.Y0 && Y <= this.m_oViewPort.Y1)
        return true;

    return false;
};
CDrawingBoard.prototype.private_IsVerLineInViewPort = function(X)
{
    if (X >= this.m_oViewPort.X0 && X <= this.m_oViewPort.X1)
        return true;

    return false;
};

var g_sBackground = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAg3SURBVHhe7ZpLltw2DEVdNfPQ83gLnmYp3kLWkiwkC0syztAzd54ICgJBEPxXVef0PXJZLeL7SH1aXbdf//ztU+DHX/8e/93w743+84EF7Kp8/uVL3EOKv0OK1cgUoDeL1UhyjOPf6T/w+Ws4dNjcLstLtFS+tzyBgWpD/biEPGZvFqsRQylwiQWEXidhP+jUIk6CWfRavUrRVmVRce5q0Ua9UgydbhXtnHI3daIbmc6Sxz9Wlq1XRY30rEzJ0yzvREHxVZYZzJm4ffvjO/2sh3G9Z0Eg3M3o0CzOTEM4Q73IUCqOM0RUGynVefv2+3cWRRudeuXRFRyulIbxDcxEfpB8FJQMzPgMWToVXiuL8MM5IKiTRmKaVfNyNGlZSgGUWTW+iYqvxQJjcRVOG2BZinB9KFHKktdmWuZmp1hp1slmfKWIxk48M7oFlcUCyl0Gh5+6h0ljo4U3fs5yU3bRohSAmbLMjwD74D84EiruKTuJYz1USwNjkm7pQylRmsxG2t0rMynQoz/xL2vWFU5HKBj7eqVi5WoPUwvVrhSRtIEnQcRXDWcZOUVLfMYxTsWyHqYGiEHapG/vJLEsraOF851hnIZroGZQulX98JSwXjoCZzlFHFtWRCnLNrEA6mbJCgx0YoD4vNDKuSaI0bdds5iaXrNIpYDcX0asXop125Npp1775sDiFOvoZ2fmHXpRtE0TbBHEQr4HTJGl1/CVPvJApcBdKbXkilsMcuo1nOW6x9FfDMqU7mgtlO6k90esKUm2vtqb0ZaPXVbAeHSYXFzRHXK8He2p7RgKTc5kOXxPpVR8bHFApJAHZzDEQjfDnVz1ff1ivs5X/RDmQUmXlzh+rT3T0oQtcxGy91mIH86R9ugK5Gj0NS1VicNlmOT9K4pKQRM8WSViTSv1LnAkk43Ht+pBJi3WKdSIUpR+WGKUZZ6zkpkU8B10lHpd16zzZZgKijS0xZ8z/NEWqCB8luJwiuHJgGNjkaoM9S4oea2cKxX3TEjdM9BwJyAmEmUlwek47q211efD7eSlHhMGRDppw47Xrzt9SgFubDnpNBCTSknQ2rXRUkIuVip8HgdPWJkoVrdSBBKE6PlcdXG40/IBtEP7hNxfCOkCsMMb5coyUoOHWINK7UO1MT0ZxBWE4xM0N7SxXpkOcL/PKnWGnoXiUBsqpuptBhkfn0IaM7VSI3mCf/6aylHCTeJIU0gkNUnEeiaoXjbAP+JzrV4IeO94zSnPvESsJZeGKVQPa2UiEPMnzUMdJUj2ZbYn6sXS8Gpavqx6yK/mx8qa12vyYkcP8RESKJVpMj7RFSRXCp/xNGzRCwfVFgfWcYT9GoKfn3HgsajWWJz46w7NZclIHVccZmEh+GYlyN3XhSoZi8847fAQKIkAglhizQ8XhKCTzWzl6Ln/t0upFAin4YqrwysrBVDepFIgffl3knfuiPjiMuWUepGNmDb1h1K4OUoBNVq1B/GVyH66aquWHcR6w0XLpupPSDOan1JZxysR+aCwExQwvOpNx/QCn97UGpViDEdx6zg4J2X+mYAVz7vi7HKovRfHq34ajqOUYpYuK/SjtjggMA+WcIy1WMPLCrBLPtsSf7SR6tpckyUNkoq1cM7zZVVaaJuZmXXFttPQVOpJeq1i5zWLgEDEO1cKnGJxS8shgfD5zpUC4StH77+NxxC+zAZOvRrvaCbs4l9TB664OUeQtrNhphGFuGbtOxM34Z4Qy6ZEYFzg2aJrTrqMl3RCIK/a4sAoToTK3bAxtzSTQlD1cosDc1CKUkA+PjDr0jKfUVss1XDcK2Aa4GDX8S5agiibRpe4V8B+nwVyz1zpavQHMFBVu4uybH359wqgdFlY3jOj6leOXcgsxmk4EBcRndJ9Gh1//FVrWNzNVT1wbM2SNSKT6pWlClIp496JE7ed1hTpnxtU6hIyILmUivR7odFELNOikVIRLehE/EuF+O2C43dVBeYdCbhfp+GMUovhp03sPO9RWSkAfaJYk0op914896AXGwxMIbsMFKnSHWJNKrUXcSY+BanG9Df/dvPUM1GRPDq8nFLEU1eWXEzGc9YHJRKxBi6B/2+kIDjtXumbf2W4yIHy2KX3IqOUwuexsub16q1D0eX+mOnMlQLXE7wqoqrgvMSMDOWUwUMqtYOM1vIXfyLxEkPXNavkgJ08Oigd74XzmgFLB+OeizQ7soSvcZi+8rj2ElR+kX5lVCeK+Uby+Mb7rFIa6fw6muYtVWtrcTFnwnjOyu1wRB3MjxDmwbWoFOhTbXEgkNczU3b9odQJpIboR3xWc5NN1axEo+Nhlv6q5Di2xKychi0hHHs1z0Aa5KON+EHM0ZZGgNML8FZWYwLHDENqiwPrUPGxxYEyziT57lqs4dkm2t1nEtV9w9nHZkoCXxEezbMUV1bLFDFdxo9gz4uK+gX+A+ZDrA4+xOrgQ6wOimJ13a0Gbm0z94RGX+e+5lC6hwIt1uR9bdL96fiyeqfhwHrpYkzZLi82bulF2phZDLGkXVeO3uZ3T4YC6ZyMLcXMXuBljq7mu4wlk1lMd9ss+3tl6/usfNWYZqBlfUlf2JdCOfRmGUNl2fKm1O9EKUU71by5psuzkJmTJRHLtGtJAJwcEmmW25i5pNmmLMqmlOUSy6+jmgB0RcjdG6nGmU0UvopiBoli7e5kVXzCiTaeKGgkyUMdd8OFnShfirwwPmFmkTtEXyJSStwB8yzrv3JU6oSYj0/kWdYkgmSkV/hUQZLnrE2dMKviE060qUSsV0CGusTa3cna+IQZc0Ei6IXtTmfmGfDTp/8Aysg4kH9KLq0AAAAASUVORK5CYII=";
