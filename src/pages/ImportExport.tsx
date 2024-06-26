import { useContext, useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import { TopBar } from "../components";
import { Category, Task, UUID } from "../types/user";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import styled from "@emotion/styled";
import { Emoji } from "emoji-picker-react";
import {
  FileDownload,
  FileUpload,
  Info,
  IntegrationInstructionsRounded,
  Link,
} from "@mui/icons-material";
import { exportTasksToJson, getFontColor, showToast } from "../utils";
import { IconButton, Tooltip } from "@mui/material";
import {
  CATEGORY_NAME_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  TASK_NAME_MAX_LENGTH,
} from "../constants";
import toast from "react-hot-toast";
import { UserContext } from "../contexts/UserContext";
import { useStorageState } from "../hooks/useStorageState";
import { useCtrlS } from "../hooks/useCtrlS";

const ImportExport = () => {
  const { user, setUser } = useContext(UserContext);
  const [selectedTasks, setSelectedTasks] = useStorageState<UUID[]>(
    [],
    "tasksToExport",
    "sessionStorage"
  ); // Array of selected task IDs
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useCtrlS();

  useEffect(() => {
    document.title = "Advanced Task - Transfer tasks";
  }, []);

  // clear file input after logout
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [user.createdAt]);

  const handleTaskClick = (taskId: UUID) => {
    setSelectedTasks((prevSelectedTasks) => {
      if (prevSelectedTasks.includes(taskId)) {
        return prevSelectedTasks.filter((id) => id !== taskId);
      } else {
        return [...prevSelectedTasks, taskId];
      }
    });
  };

  const handleExport = () => {
    const tasksToExport = user.tasks.filter((task) => selectedTasks.includes(task.id));
    exportTasksToJson(tasksToExport);
    toast(
      (t) => (
        <div>
          Exported tasks:{" "}
          <ul>
            {tasksToExport.map((task) => (
              <li key={task.id}>
                <ListContent>
                  <Emoji unified={task.emoji || ""} size={20} emojiStyle={user.emojisStyle} />
                  <span>{task.name}</span>
                </ListContent>
              </li>
            ))}
          </ul>
          <Button
            variant="outlined"
            sx={{ width: "100%", p: "12px 24px", borderRadius: "16px", fontSize: "16px" }}
            onClick={() => toast.dismiss(t.id)}
          >
            Dimiss
          </Button>
        </div>
      )
      // { icon: <FileDownload /> }
    );
  };

  const handleExportAll = () => {
    exportTasksToJson(user.tasks);
    showToast(`Exported all tasks (${user.tasks.length})`);
  };

  const handleImport = (taskFile: File) => {
    const file = taskFile;

    if (file) {
      if (file.type !== "application/json") {
        showToast(
          <div>
            Incorrect file type{file.type !== "" && <span> {file.type}</span>}. Please select a JSON
            file.
          </div>,
          { type: "error" }
        );
        return;
      }

      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const importedTasks = JSON.parse(e.target?.result as string) as Task[];

          if (!Array.isArray(importedTasks)) {
            showToast("Imported file has an invalid structure.", { type: "error" });
            return;
          }

          /**
           * TODO: write separate util function to check if task is not invalid
           */

          // Check if any imported task property exceeds the maximum length
          const invalidTasks = importedTasks.filter((task) => {
            const isInvalid =
              (task.name && task.name.length > TASK_NAME_MAX_LENGTH) ||
              (task.description && task.description.length > DESCRIPTION_MAX_LENGTH) ||
              (task.category &&
                task.category.some((cat) => cat.name.length > CATEGORY_NAME_MAX_LENGTH));

            return isInvalid;
          });

          if (invalidTasks.length > 0) {
            const invalidTaskNames = invalidTasks.map((task) => task.name).join(", ");
            console.error(
              `These tasks cannot be imported due to exceeding maximum character lengths: ${invalidTaskNames}`
            );
            showToast(
              `These tasks cannot be imported due to exceeding maximum character lengths: ${invalidTaskNames}`,
              { type: "error" }
            );
            return;
          }

          const isHexColor = (value: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(value);

          const isCategoryColorValid = (category: Category) =>
            category.color && isHexColor(category.color);

          const hasInvalidColors = importedTasks.some((task) => {
            return (
              (task.color && !isHexColor(task.color)) ||
              (task.category && !task.category.every((cat) => isCategoryColorValid(cat)))
            );
          });

          if (hasInvalidColors) {
            showToast("Imported file contains tasks with invalid color formats.", {
              type: "error",
            });
            return;
          }

          const maxFileSize = 50_000;
          if (file.size > maxFileSize) {
            showToast(`File size is too large (${file.size}/${maxFileSize})`, { type: "error" });
            return;
          }
          console.log(file.text);

          // Update user.categories if imported categories don't exist
          const updatedCategories = user.categories.slice(); // Create a copy of the existing categories

          importedTasks.forEach((task) => {
            task.category !== undefined &&
              task.category.forEach((importedCat) => {
                const existingCategory = updatedCategories.find((cat) => cat.id === importedCat.id);

                if (!existingCategory) {
                  updatedCategories.push(importedCat);
                } else {
                  // Replace the existing category with the imported one if the ID matches
                  Object.assign(existingCategory, importedCat);
                }
              });
          });

          setUser((prevUser) => ({
            ...prevUser,
            categories: updatedCategories,
          }));

          const mergedTasks = [...user.tasks, ...importedTasks];
          const uniqueTasks = mergedTasks.reduce((acc, task) => {
            const existingTask = acc.find((t) => t.id === task.id);
            if (existingTask) {
              return acc.map((t) => (t.id === task.id ? task : t));
            } else {
              return [...acc, task];
            }
          }, [] as Task[]);

          setUser((prevUser) => ({ ...prevUser, tasks: uniqueTasks }));

          // Prepare the list of imported task names
          const importedTaskNames = importedTasks.map((task) => task.name).join(", ");

          // Display the alert with the list of imported task names
          console.log(`Imported Tasks: ${importedTaskNames}`);

          toast((t) => (
            <div>
              Tasks Successfully Imported from <br />
              <i translate="no" style={{ wordBreak: "break-all" }}>
                {file.name}
              </i>
              <ul>
                {importedTasks.map((task) => (
                  <li key={task.id}>
                    <ListContent>
                      <Emoji unified={task.emoji || ""} size={20} emojiStyle={user.emojisStyle} />
                      <span translate="no">{task.name}</span>
                    </ListContent>
                  </li>
                ))}
              </ul>
              <Button
                variant="outlined"
                sx={{ width: "100%", p: "12px 24px", borderRadius: "16px", fontSize: "16px" }}
                onClick={() => toast.dismiss(t.id)}
              >
                Dimiss
              </Button>
            </div>
          ));

          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error) {
          console.error(`Error parsing the imported file ${file.name}:`, error);
          showToast(
            <div style={{ wordBreak: "break-all" }}>
              Error parsing the imported file: <br /> <i>{file.name}</i>
            </div>,
            { type: "error" }
          );
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };

      reader.readAsText(file);
    }
  };

  const handleImportFromLink = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith(`${location.protocol}//${location.hostname}`)) {
        window.open(text, "_self");
      } else {
        showToast(
          <div>
            Failed to import task from the provided link. Please ensure that the link is copied
            correctly.
          </div>,
          { type: "error" }
        );
      }
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
    }
  };

  const handleImportFromClipboard = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      const file = new File([text], "Clipboard", { type: "application/json" });
      handleImport(file);
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    console.log(file);
    if (file.size === 0 || file.type === "") {
      showToast(
        <div>
          Unknown file type{" "}
          <i translate="no" style={{ wordBreak: "break-all" }}>
            {file.name}
          </i>
        </div>,
        { type: "error" }
      );
      return;
    }
    handleImport(file);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    file && handleImport(file);
  };

  return (
    <>
      <TopBar title="Transfer Tasks" />
      <h2
        style={{
          textAlign: "center",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        Select Tasks To Export&nbsp;
        <Tooltip title="Duplicates will be removed during import">
          <IconButton style={{ color: "#ffffff" }}>
            <InfoIcon />
          </IconButton>
        </Tooltip>
      </h2>

      <Container>
        {user.tasks.length > 0 ? (
          user.tasks.map((task: Task) => (
            <TaskContainer
              key={task.id}
              backgroundclr={task.color}
              onClick={() => handleTaskClick(task.id)}
              selected={selectedTasks.includes(task.id)}
              translate="no"
            >
              <Checkbox color="primary" size="medium" checked={selectedTasks.includes(task.id)} />
              <Typography
                variant="body1"
                component="span"
                sx={{ display: "flex", alignItems: "center", gap: "6px", wordBreak: "break-word" }}
              >
                <Emoji size={24} unified={task.emoji || ""} emojiStyle={user.emojisStyle} />{" "}
                {task.name}
              </Typography>
            </TaskContainer>
          ))
        ) : (
          <h3 style={{ opacity: 0.8, fontStyle: "italic" }}>You don't have any tasks to export</h3>
        )}
      </Container>

      <Box
        component="div"
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <Tooltip
          title={
            selectedTasks.length > 0
              ? `Selected tasks: ${new Intl.ListFormat("en", {
                  style: "long",
                  type: "conjunction",
                }).format(
                  selectedTasks.map((taskId) => {
                    const selectedTask = user.tasks.find((task) => task.id === taskId);
                    return selectedTask ? selectedTask.name : "";
                  })
                )}`
              : "No tasks selected"
          }
        >
          <StyledButton onClick={handleExport} disabled={selectedTasks.length === 0}>
            <FileDownload /> &nbsp; Export Selected to JSON{" "}
            {selectedTasks.length > 0 && `[${selectedTasks.length}]`}
          </StyledButton>
        </Tooltip>
        <StyledButton onClick={handleExportAll} disabled={user.tasks.length === 0}>
          <FileDownload /> &nbsp; Export All Tasks to JSON
        </StyledButton>

        <h2 style={{ textAlign: "center" }}>Import Tasks From JSON</h2>

        {/Windows|Linux|Macintosh/i.test(navigator.userAgent) && (
          <div style={{ width: "300px" }}>
            <DropZone
              onDragOver={handleDragOver}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              isDragging={isDragging}
            >
              <FileUpload fontSize="large" color="primary" />
              <div>Drop JSON file here to import tasks </div>
            </DropZone>
          </div>
        )}

        <input
          accept=".json"
          id="import-file"
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleSelectChange}
        />
        <label htmlFor="import-file">
          <Button
            component="span"
            variant="outlined"
            sx={{
              p: "12px 20px",
              borderRadius: "14px",
              width: "300px",
            }}
          >
            <FileUpload /> &nbsp; Select JSON File
          </Button>
        </label>

        <StyledButton onClick={handleImportFromClipboard}>
          <IntegrationInstructionsRounded /> &nbsp; Import JSON from clipboard
        </StyledButton>

        {/* Solution for PWA on iOS: */}
        <StyledButton onClick={handleImportFromLink}>
          <Link /> &nbsp; Import From Link
        </StyledButton>
      </Box>
    </>
  );
};

export default ImportExport;

const TaskContainer = styled(Box)<{ backgroundclr: string; selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: left;
  margin: 8px;
  padding: 10px 4px;
  border-radius: 16px;
  background: ${({ theme }) => getFontColor(theme.secondary)}15;
  border: 2px solid ${({ backgroundclr }) => backgroundclr};
  box-shadow: ${({ selected, backgroundclr }) => selected && `0 0 8px 1px ${backgroundclr}`};
  transition: 0.3s all;
  width: 300px;
  cursor: "pointer";
  & span {
    font-weight: ${({ selected }) => (selected ? 600 : 500)}!important;
  }
`;

const ListContent = styled.div`
  display: flex;
  justify-content: left;
  align-items: center;
  gap: 6px;
`;

const DropZone = styled.div<{ isDragging: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 6px;
  border: 2px dashed ${({ theme }) => theme.primary};
  border-radius: 16px;
  padding: 32px 64px;
  text-align: center;
  max-width: 300px;
  box-shadow: ${({ isDragging, theme }) => isDragging && `0 0 32px 0px ${theme.primary}`};
  transition: 0.3s all;
  & div {
    font-weight: 500;
  }
`;

const InfoIcon = styled(Info)`
  color: ${({ theme }) => getFontColor(theme.secondary)};
`;

const Container = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 20px;
  max-height: 350px;

  overflow-y: auto;

  /* Custom Scrollbar Styles */
  ::-webkit-scrollbar {
    width: 8px;
    border-radius: 4px;
    background-color: ${({ theme }) => getFontColor(theme.secondary)}15;
  }

  ::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => getFontColor(theme.secondary)}30;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background-color: ${({ theme }) => getFontColor(theme.secondary)}50;
  }

  ::-webkit-scrollbar-track {
    border-radius: 4px;
    background-color: ${({ theme }) => getFontColor(theme.secondary)}15;
  }
`;

const StyledButton = styled(Button)`
  padding: 12px 18px;
  border-radius: 14px;
  width: 300px;

  &:disabled {
    color: ${({ theme }) => getFontColor(theme.secondary) + "82"};
    border-color: ${({ theme }) => getFontColor(theme.secondary) + "82"};
  }
`;
StyledButton.defaultProps = {
  variant: "outlined",
};
